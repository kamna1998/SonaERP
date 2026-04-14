import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '../../config/database';
import { logAuditEvent } from '../../middleware/auditLog';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  BlacklistSupplierInput,
  ListSuppliersQuery,
} from './suppliers.validation';

function cleanOptional<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// ============================================================
// CREATE
// ============================================================
export async function createSupplier(
  input: CreateSupplierInput,
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const clean = cleanOptional(input);
  const existing = await prisma.supplier.findUnique({
    where: { registrationNumber: input.registrationNumber },
  });
  if (existing) {
    throw new ConflictError(
      `Fournisseur déjà enregistré avec le numéro ${input.registrationNumber}`
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      registrationNumber: clean.registrationNumber!,
      companyNameFr: clean.companyNameFr!,
      companyNameAr: clean.companyNameAr ?? null,
      contactEmail: clean.contactEmail ?? null,
      contactPhone: clean.contactPhone ?? null,
      address: clean.address ?? null,
      wilaya: clean.wilaya ?? null,
      country: clean.country || 'DZ',
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.CREATE,
    resource: 'supplier',
    resourceId: supplier.id,
    ipAddress: ip,

    userAgent,
    metadata: { registrationNumber: supplier.registrationNumber },
  });

  return supplier;
}

// ============================================================
// LIST
// ============================================================
export async function listSuppliers(query: ListSuppliersQuery) {
  const { page, limit, search, isBlacklisted, wilaya, sortBy, sortOrder } = query;

  const where: Prisma.SupplierWhereInput = {};
  if (typeof isBlacklisted === 'boolean') where.isBlacklisted = isBlacklisted;
  if (wilaya) where.wilaya = wilaya;
  if (search) {
    where.OR = [
      { companyNameFr: { contains: search, mode: 'insensitive' } },
      { companyNameAr: { contains: search, mode: 'insensitive' } },
      { registrationNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: { select: { bids: true } },
      },
    }),
    prisma.supplier.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ============================================================
// GET BY ID
// ============================================================
export async function getSupplierById(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      bids: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          receivedAt: true,
          projectId: true,
          project: { select: { referenceNumber: true, titleFr: true } },
        },
        orderBy: { receivedAt: 'desc' },
        take: 20,
      },
      _count: { select: { bids: true } },
    },
  });
  if (!supplier) throw new NotFoundError('Supplier', id);
  return supplier;
}

// ============================================================
// UPDATE
// ============================================================
export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Supplier', id);

  if (input.registrationNumber && input.registrationNumber !== existing.registrationNumber) {
    const dup = await prisma.supplier.findUnique({
      where: { registrationNumber: input.registrationNumber },
    });
    if (dup) throw new ConflictError('Numéro d’enregistrement déjà utilisé');
  }

  const clean = cleanOptional(input);
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...(clean.registrationNumber !== undefined && { registrationNumber: clean.registrationNumber }),
      ...(clean.companyNameFr !== undefined && { companyNameFr: clean.companyNameFr }),
      ...(clean.companyNameAr !== undefined && { companyNameAr: clean.companyNameAr }),
      ...(clean.contactEmail !== undefined && { contactEmail: clean.contactEmail }),
      ...(clean.contactPhone !== undefined && { contactPhone: clean.contactPhone }),
      ...(clean.address !== undefined && { address: clean.address }),
      ...(clean.wilaya !== undefined && { wilaya: clean.wilaya }),
      ...(clean.country !== undefined && { country: clean.country }),
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.UPDATE,
    resource: 'supplier',
    resourceId: supplier.id,
    ipAddress: ip,

    userAgent,
  });

  return supplier;
}

// ============================================================
// BLACKLIST / UNBLACKLIST
// ============================================================
export async function setBlacklistStatus(
  id: string,
  input: BlacklistSupplierInput,
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Supplier', id);

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      isBlacklisted: input.isBlacklisted,
      blacklistReason: input.isBlacklisted ? input.blacklistReason ?? null : null,
    },
  });

  await logAuditEvent({
    actorId: userId,
    action: AuditAction.STATUS_CHANGE,
    resource: 'supplier',
    resourceId: supplier.id,
    ipAddress: ip,

    userAgent,
    metadata: {
      blacklisted: input.isBlacklisted,
      reason: input.blacklistReason || null,
    },
  });

  return supplier;
}
