/**
 * Permission constants used throughout the application.
 * Format: resource:action or resource:action:scope
 */
export const PERMISSIONS = {
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_READ_OWN: 'user:read:own',
  USER_UPDATE: 'user:update',
  USER_UPDATE_OWN: 'user:update:own',
  USER_DELETE: 'user:delete',
  USER_ASSIGN_ROLE: 'user:assign_role',

  // Role management
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',

  // Department
  DEPARTMENT_READ: 'department:read',
  DEPARTMENT_MANAGE: 'department:manage',

  // Project
  PROJECT_CREATE: 'project:create',
  PROJECT_CREATE_OWN_DEPT: 'project:create:own_dept',
  PROJECT_READ: 'project:read',
  PROJECT_READ_OWN_DEPT: 'project:read:own_dept',
  PROJECT_READ_ASSIGNED: 'project:read:assigned',
  PROJECT_UPDATE: 'project:update',
  PROJECT_UPDATE_OWN_DEPT: 'project:update:own_dept',
  PROJECT_DELETE: 'project:delete',
  PROJECT_CHANGE_STATUS: 'project:change_status',
  PROJECT_APPROVE: 'project:approve',
  PROJECT_APPROVE_OWN_DEPT: 'project:approve:own_dept',
  PROJECT_VIEW_BUDGET: 'project:view_budget',
  PROJECT_VIEW_BUDGET_OWN_DEPT: 'project:view_budget:own_dept',

  // DTAO
  DTAO_CREATE: 'dtao:create',
  DTAO_CREATE_OWN_DEPT: 'dtao:create:own_dept',
  DTAO_READ_TECHNICAL: 'dtao:read_technical',
  DTAO_READ_TECHNICAL_OWN_DEPT: 'dtao:read_technical:own_dept',
  DTAO_READ_TECHNICAL_ASSIGNED: 'dtao:read_technical:assigned',
  DTAO_READ_COMMERCIAL: 'dtao:read_commercial',
  DTAO_READ_COMMERCIAL_ASSIGNED: 'dtao:read_commercial:assigned',
  DTAO_UPDATE: 'dtao:update',
  DTAO_APPROVE: 'dtao:approve',
  DTAO_PUBLISH: 'dtao:publish',

  // Bid
  BID_REGISTER: 'bid:register',
  BID_READ_TECHNICAL: 'bid:read_technical',
  BID_READ_TECHNICAL_OWN_DEPT: 'bid:read_technical:own_dept',
  BID_READ_TECHNICAL_ASSIGNED: 'bid:read_technical:assigned',
  BID_READ_COMMERCIAL: 'bid:read_commercial',
  BID_READ_COMMERCIAL_ASSIGNED: 'bid:read_commercial:assigned',
  BID_OPEN_TECHNICAL: 'bid:open_technical',
  BID_OPEN_COMMERCIAL: 'bid:open_commercial',
  BID_EVALUATE_TECHNICAL: 'bid:evaluate_technical',
  BID_EVALUATE_COMMERCIAL: 'bid:evaluate_commercial',
  BID_AWARD: 'bid:award',

  // CCC
  CCC_SCHEDULE: 'ccc:schedule',
  CCC_READ: 'ccc:read',
  CCC_READ_ASSIGNED: 'ccc:read:assigned',
  CCC_START_SESSION: 'ccc:start_session',
  CCC_VOTE: 'ccc:vote',
  CCC_GENERATE_PV: 'ccc:generate_pv',
  CCC_SIGN_PV: 'ccc:sign_pv',

  // Contract
  CONTRACT_CREATE: 'contract:create',
  CONTRACT_READ: 'contract:read',
  CONTRACT_READ_OWN_DEPT: 'contract:read:own_dept',
  CONTRACT_UPDATE: 'contract:update',
  CONTRACT_VISA_LEGAL: 'contract:visa_legal',
  CONTRACT_VISA_FINANCIAL: 'contract:visa_financial',
  CONTRACT_APPROVE: 'contract:approve',
  CONTRACT_APPROVE_OWN_DEPT: 'contract:approve:own_dept',
  CONTRACT_SIGN: 'contract:sign',

  // Avenant
  AVENANT_CREATE: 'avenant:create',
  AVENANT_CREATE_OWN_DEPT: 'avenant:create:own_dept',
  AVENANT_READ: 'avenant:read',
  AVENANT_READ_OWN_DEPT: 'avenant:read:own_dept',
  AVENANT_VALIDATE_THRESHOLD: 'avenant:validate_threshold',
  AVENANT_VISA_LEGAL: 'avenant:visa_legal',
  AVENANT_VISA_FINANCIAL: 'avenant:visa_financial',
  AVENANT_APPROVE: 'avenant:approve',
  AVENANT_APPROVE_OWN_DEPT: 'avenant:approve:own_dept',

  // Audit
  AUDIT_READ: 'audit:read',
  AUDIT_READ_OWN: 'audit:read:own',
  AUDIT_EXPORT: 'audit:export',

  // Config
  CONFIG_MANAGE: 'config:manage',

  // Notification
  NOTIFICATION_READ_OWN: 'notification:read:own',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
