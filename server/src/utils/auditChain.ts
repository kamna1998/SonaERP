import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '../config/database';
import { sha256 } from './hash';
import { logger } from './logger';

/**
 * Hash-chained immutable audit log (Phase 1 — Legal Gatekeeper §3).
 *
 * Each entry is sealed by SHA-256(payload || previousChainHash), forming a
 * tamper-evident chain. Any mutation or deletion of a prior entry breaks every
 * subsequent hash, so the chain is cryptographically verifiable.
 *
 * The chain is single-writer: writes go through `appendAuditEntry()` which uses
 * a SERIALIZABLE transaction to fetch the latest chainHash and link to it.
 */

export interface AuditChainEntryInput {
  actorId?: string | null;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description?: string;
  justification?: string;
  previousState?: any;
  newState?: any;
  documentHash?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

function canonicalizePayload(entry: AuditChainEntryInput, sequence: number, createdAtIso: string, previousHash: string | null): string {
  // Canonical, deterministic payload — ordering of keys MUST be stable so the
  // hash is reproducible by any verifier.
  return [
    `seq:${sequence}`,
    `at:${createdAtIso}`,
    `actor:${entry.actorId ?? 'system'}`,
    `action:${entry.action}`,
    `resource:${entry.resource}`,
    `resourceId:${entry.resourceId ?? ''}`,
    `description:${entry.description ?? ''}`,
    `justification:${entry.justification ?? ''}`,
    `documentHash:${entry.documentHash ?? ''}`,
    `previousState:${entry.previousState ? JSON.stringify(entry.previousState) : ''}`,
    `newState:${entry.newState ? JSON.stringify(entry.newState) : ''}`,
    `prev:${previousHash ?? 'GENESIS'}`,
  ].join('|');
}

/**
 * Append a single audit entry, sealing it with the chain.
 * Returns the persisted entry's chainHash for downstream verification.
 */
export async function appendAuditEntry(entry: AuditChainEntryInput): Promise<string> {
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const last = await tx.auditLog.findFirst({
          orderBy: { sequence: 'desc' },
          select: { chainHash: true, sequence: true },
        });

        const previousHash = last?.chainHash ?? null;
        const createdAt = new Date();
        // sequence is autoincrement; we precompute the expected next value for hashing,
        // but we let Postgres assign the real one — we then re-hash with the actual seq.
        // To keep the chain deterministic we use the DB-assigned seq AFTER insert via update.
        const tentativeSeq = (last?.sequence ?? 0) + 1;
        const tentativeHash = sha256(
          canonicalizePayload(entry, tentativeSeq, createdAt.toISOString(), previousHash),
        );

        const created = await tx.auditLog.create({
          data: {
            actorId: entry.actorId ?? null,
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
            description: entry.description,
            justification: entry.justification,
            previousState: entry.previousState ?? Prisma.JsonNull,
            newState: entry.newState ?? Prisma.JsonNull,
            documentHash: entry.documentHash,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            metadata: entry.metadata ?? Prisma.JsonNull,
            previousHash,
            chainHash: tentativeHash,
            createdAt,
          },
          select: { id: true, sequence: true, chainHash: true },
        });

        // Defensive: if Postgres assigned a different sequence than expected
        // (concurrent writers raced past us), recompute and update.
        if (created.sequence !== tentativeSeq) {
          const correctedHash = sha256(
            canonicalizePayload(entry, created.sequence, createdAt.toISOString(), previousHash),
          );
          await tx.auditLog.update({
            where: { id: created.id },
            data: { chainHash: correctedHash },
          });
          return correctedHash;
        }

        return created.chainHash!;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return result;
  } catch (err: any) {
    logger.error('Failed to append audit chain entry', {
      action: entry.action,
      resource: entry.resource,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Verify the integrity of the audit chain over a range of entries.
 * Returns the first broken-link sequence, or null if the chain is intact.
 */
export async function verifyAuditChain(fromSequence = 1, toSequence?: number): Promise<{
  valid: boolean;
  brokenAtSequence?: number;
  totalChecked: number;
}> {
  const entries = await prisma.auditLog.findMany({
    where: {
      sequence: {
        gte: fromSequence,
        ...(toSequence ? { lte: toSequence } : {}),
      },
    },
    orderBy: { sequence: 'asc' },
  });

  let previousHash: string | null = null;
  let totalChecked = 0;

  for (const e of entries) {
    totalChecked++;
    if (e.previousHash !== previousHash && totalChecked > 1) {
      return { valid: false, brokenAtSequence: e.sequence, totalChecked };
    }

    const recomputed = sha256(
      canonicalizePayload(
        {
          actorId: e.actorId,
          action: e.action,
          resource: e.resource,
          resourceId: e.resourceId ?? undefined,
          description: e.description ?? undefined,
          justification: e.justification ?? undefined,
          previousState: e.previousState,
          newState: e.newState,
          documentHash: e.documentHash ?? undefined,
        },
        e.sequence,
        e.createdAt.toISOString(),
        e.previousHash,
      ),
    );

    if (recomputed !== e.chainHash) {
      return { valid: false, brokenAtSequence: e.sequence, totalChecked };
    }

    previousHash = e.chainHash;
  }

  return { valid: true, totalChecked };
}

/**
 * Compute the "head" hash of the audit chain — useful for periodic anchoring
 * (e.g., publishing the head to an immutable store / blockchain / printed log).
 */
export async function getAuditChainHead(): Promise<{ sequence: number; chainHash: string } | null> {
  const last = await prisma.auditLog.findFirst({
    orderBy: { sequence: 'desc' },
    select: { sequence: true, chainHash: true },
  });
  if (!last || !last.chainHash) return null;
  return { sequence: last.sequence, chainHash: last.chainHash };
}
