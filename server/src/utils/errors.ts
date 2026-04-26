export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(msg, 404, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class AccountLockedError extends AppError {
  constructor(lockedUntil: Date) {
    super(
      `Account is locked until ${lockedUntil.toISOString()}`,
      423,
      'ACCOUNT_LOCKED'
    );
  }
}

/**
 * Compliance gate failure (Phase 1 — Legal Gatekeeper).
 * Returned by middleware when a workflow step is blocked due to missing
 * mandatory documents, separation-of-powers conflicts, or admin-procurement
 * rule violations.
 */
export class ComplianceError extends AppError {
  public readonly missing?: Array<{ type: string; descriptionFr: string; legalReference?: string }>;

  constructor(
    message: string,
    missing?: Array<{ type: string; descriptionFr: string; legalReference?: string }>,
  ) {
    super(message, 400, 'COMPLIANCE_ERROR');
    this.missing = missing;
  }
}
