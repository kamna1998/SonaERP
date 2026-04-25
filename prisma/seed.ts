import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SonaERP database...');

  // ============================================================
  // 1. DEPARTMENTS
  // ============================================================
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'DG' },
      update: {},
      create: {
        code: 'DG',
        nameFr: 'Direction Générale',
        nameAr: 'المديرية العامة',
        nameEn: 'General Management',
      },
    }),
    prisma.department.upsert({
      where: { code: 'DTI' },
      update: {},
      create: {
        code: 'DTI',
        nameFr: 'Direction Technique et Ingénierie',
        nameAr: 'مديرية التقنية والهندسة',
        nameEn: 'Technical & Engineering Department',
      },
    }),
    prisma.department.upsert({
      where: { code: 'DAL' },
      update: {},
      create: {
        code: 'DAL',
        nameFr: 'Direction Approvisionnement et Logistique',
        nameAr: 'مديرية التموين واللوجستيك',
        nameEn: 'Procurement & Logistics Department',
      },
    }),
    prisma.department.upsert({
      where: { code: 'DJR' },
      update: {},
      create: {
        code: 'DJR',
        nameFr: 'Direction Juridique',
        nameAr: 'المديرية القانونية',
        nameEn: 'Legal Department',
      },
    }),
    prisma.department.upsert({
      where: { code: 'DFC' },
      update: {},
      create: {
        code: 'DFC',
        nameFr: 'Direction Finance et Comptabilité',
        nameAr: 'مديرية المالية والمحاسبة',
        nameEn: 'Finance & Accounting Department',
      },
    }),
    prisma.department.upsert({
      where: { code: 'DAU' },
      update: {},
      create: {
        code: 'DAU',
        nameFr: 'Direction Audit',
        nameAr: 'مديرية التدقيق',
        nameEn: 'Audit Department',
      },
    }),
  ]);

  const deptMap = Object.fromEntries(departments.map((d) => [d.code, d]));
  console.log(`  ✓ ${departments.length} departments seeded`);

  // ============================================================
  // 2. ROLES
  // ============================================================
  const roleDefinitions = [
    {
      code: 'SYS_ADMIN',
      nameFr: 'Administrateur Système',
      nameAr: 'مدير النظام',
      nameEn: 'System Administrator',
      description: 'Full system access for user management and configuration',
      isSystem: true,
    },
    {
      code: 'INITIATOR',
      nameFr: 'Initiateur (Service Technique)',
      nameAr: 'المبادر (القسم التقني)',
      nameEn: 'Initiator (Technical Department)',
      description: 'Creates procurement needs and writes technical specifications',
      isSystem: true,
    },
    {
      code: 'PROC_OFFICER',
      nameFr: 'Chargé de Passation',
      nameAr: 'مسؤول المناقصات',
      nameEn: 'Procurement Officer',
      description: 'Manages tender process end-to-end, handles commercial data',
      isSystem: true,
    },
    {
      code: 'LEGAL_ADVISOR',
      nameFr: 'Conseiller Juridique',
      nameAr: 'المستشار القانوني',
      nameEn: 'Legal Advisor',
      description: 'Reviews DTAO legality, provides contract visa',
      isSystem: true,
    },
    {
      code: 'CCC_PRESIDENT',
      nameFr: 'Président CCC',
      nameAr: 'رئيس لجنة مراقبة الصفقات',
      nameEn: 'CCC President',
      description: 'Chairs commission meetings, casts deciding vote',
      isSystem: true,
    },
    {
      code: 'CCC_MEMBER',
      nameFr: 'Membre CCC',
      nameAr: 'عضو لجنة مراقبة الصفقات',
      nameEn: 'CCC Member',
      description: 'Evaluates bids and votes in commission meetings',
      isSystem: true,
    },
    {
      code: 'CCC_RAPPORTEUR',
      nameFr: 'Rapporteur CCC',
      nameAr: 'مقرر لجنة مراقبة الصفقات',
      nameEn: 'CCC Rapporteur',
      description: 'Drafts PV (minutes) for commission meetings',
      isSystem: true,
    },
    {
      code: 'FINANCE_CONTROLLER',
      nameFr: 'Contrôleur Financier',
      nameAr: 'المراقب المالي',
      nameEn: 'Finance Controller',
      description: 'Financial visa on contracts, threshold verification',
      isSystem: true,
    },
    {
      code: 'STRUCTURE_MANAGER',
      nameFr: 'Responsable de Structure',
      nameAr: 'مسؤول الهيكل',
      nameEn: 'Structure Manager',
      description: 'Approves department procurement requests',
      isSystem: true,
    },
    {
      code: 'DG_APPROVER',
      nameFr: 'Approbateur DG',
      nameAr: 'المصادق - المدير العام',
      nameEn: 'DG Approver',
      description: 'Final approval authority on high-value contracts',
      isSystem: true,
    },
    {
      code: 'AUDITOR',
      nameFr: 'Auditeur',
      nameAr: 'المدقق',
      nameEn: 'Auditor',
      description: 'Read-only access to all audit logs and reports',
      isSystem: true,
    },
  ];

  const roles = await Promise.all(
    roleDefinitions.map((r) =>
      prisma.role.upsert({
        where: { code: r.code },
        update: {},
        create: r,
      })
    )
  );

  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r]));
  console.log(`  ✓ ${roles.length} roles seeded`);

  // ============================================================
  // 3. PERMISSIONS
  // ============================================================
  const permissionDefinitions = [
    // --- User management ---
    { code: 'user:create', resource: 'user', action: 'create', scope: 'all', description: 'Create new users' },
    { code: 'user:read', resource: 'user', action: 'read', scope: 'all', description: 'View all users' },
    { code: 'user:read:own', resource: 'user', action: 'read', scope: 'own', description: 'View own profile' },
    { code: 'user:update', resource: 'user', action: 'update', scope: 'all', description: 'Update any user' },
    { code: 'user:update:own', resource: 'user', action: 'update', scope: 'own', description: 'Update own profile' },
    { code: 'user:delete', resource: 'user', action: 'delete', scope: 'all', description: 'Deactivate users' },
    { code: 'user:assign_role', resource: 'user', action: 'assign_role', scope: 'all', description: 'Assign roles to users' },

    // --- Role management ---
    { code: 'role:read', resource: 'role', action: 'read', scope: 'all', description: 'View all roles' },
    { code: 'role:create', resource: 'role', action: 'create', scope: 'all', description: 'Create custom roles' },
    { code: 'role:update', resource: 'role', action: 'update', scope: 'all', description: 'Update roles' },

    // --- Department ---
    { code: 'department:read', resource: 'department', action: 'read', scope: 'all', description: 'View departments' },
    { code: 'department:manage', resource: 'department', action: 'manage', scope: 'all', description: 'Create/update departments' },

    // --- Project ---
    { code: 'project:create', resource: 'project', action: 'create', scope: 'all', description: 'Create projects (any dept)' },
    { code: 'project:create:own_dept', resource: 'project', action: 'create', scope: 'own_department', description: 'Create projects (own dept)' },
    { code: 'project:read', resource: 'project', action: 'read', scope: 'all', description: 'View all projects' },
    { code: 'project:read:own_dept', resource: 'project', action: 'read', scope: 'own_department', description: 'View own dept projects' },
    { code: 'project:read:assigned', resource: 'project', action: 'read', scope: 'assigned_project', description: 'View assigned projects' },
    { code: 'project:update', resource: 'project', action: 'update', scope: 'all', description: 'Update any project' },
    { code: 'project:update:own_dept', resource: 'project', action: 'update', scope: 'own_department', description: 'Update own dept projects' },
    { code: 'project:delete', resource: 'project', action: 'delete', scope: 'all', description: 'Delete projects' },
    { code: 'project:change_status', resource: 'project', action: 'change_status', scope: 'all', description: 'Change project status' },
    { code: 'project:approve', resource: 'project', action: 'approve', scope: 'all', description: 'Approve projects' },
    { code: 'project:approve:own_dept', resource: 'project', action: 'approve', scope: 'own_department', description: 'Approve own dept projects' },
    { code: 'project:view_budget', resource: 'project', action: 'view_budget', scope: 'all', description: 'View project budgets' },
    { code: 'project:view_budget:own_dept', resource: 'project', action: 'view_budget', scope: 'own_department', description: 'View own dept budgets' },

    // --- DTAO ---
    { code: 'dtao:create', resource: 'dtao', action: 'create', scope: 'all', description: 'Create DTAO' },
    { code: 'dtao:create:own_dept', resource: 'dtao', action: 'create', scope: 'own_department', description: 'Create DTAO (own dept)' },
    { code: 'dtao:read_technical', resource: 'dtao', action: 'read_technical', scope: 'all', description: 'Read technical vault' },
    { code: 'dtao:read_technical:own_dept', resource: 'dtao', action: 'read_technical', scope: 'own_department', description: 'Read tech vault (own dept)' },
    { code: 'dtao:read_technical:assigned', resource: 'dtao', action: 'read_technical', scope: 'assigned_project', description: 'Read tech vault (assigned)' },
    { code: 'dtao:read_commercial', resource: 'dtao', action: 'read_commercial', scope: 'all', description: 'Read commercial vault' },
    { code: 'dtao:read_commercial:assigned', resource: 'dtao', action: 'read_commercial', scope: 'assigned_project', description: 'Read commercial vault (assigned)' },
    { code: 'dtao:update', resource: 'dtao', action: 'update', scope: 'all', description: 'Update DTAO' },
    { code: 'dtao:approve', resource: 'dtao', action: 'approve', scope: 'all', description: 'Approve DTAO' },
    { code: 'dtao:publish', resource: 'dtao', action: 'publish', scope: 'all', description: 'Publish DTAO' },

    // --- Bid ---
    { code: 'bid:register', resource: 'bid', action: 'register', scope: 'all', description: 'Register incoming bids' },
    { code: 'bid:read_technical', resource: 'bid', action: 'read_technical', scope: 'all', description: 'Read technical bids' },
    { code: 'bid:read_technical:own_dept', resource: 'bid', action: 'read_technical', scope: 'own_department', description: 'Read tech bids (own dept)' },
    { code: 'bid:read_technical:assigned', resource: 'bid', action: 'read_technical', scope: 'assigned_project', description: 'Read tech bids (assigned)' },
    { code: 'bid:read_commercial', resource: 'bid', action: 'read_commercial', scope: 'all', description: 'Read commercial bids' },
    { code: 'bid:read_commercial:assigned', resource: 'bid', action: 'read_commercial', scope: 'assigned_project', description: 'Read commercial bids (assigned)' },
    { code: 'bid:open_technical', resource: 'bid', action: 'open_technical', scope: 'all', description: 'Open technical envelopes' },
    { code: 'bid:open_commercial', resource: 'bid', action: 'open_commercial', scope: 'all', description: 'Open commercial envelopes' },
    { code: 'bid:evaluate_technical', resource: 'bid', action: 'evaluate_technical', scope: 'all', description: 'Evaluate technical bids' },
    { code: 'bid:evaluate_commercial', resource: 'bid', action: 'evaluate_commercial', scope: 'all', description: 'Evaluate commercial bids' },
    { code: 'bid:award', resource: 'bid', action: 'award', scope: 'all', description: 'Award bids' },

    // --- CCC ---
    { code: 'ccc:schedule', resource: 'ccc', action: 'schedule', scope: 'all', description: 'Schedule CCC meetings' },
    { code: 'ccc:read', resource: 'ccc', action: 'read', scope: 'all', description: 'View CCC meetings' },
    { code: 'ccc:read:assigned', resource: 'ccc', action: 'read', scope: 'assigned_project', description: 'View assigned CCC meetings' },
    { code: 'ccc:start_session', resource: 'ccc', action: 'start_session', scope: 'all', description: 'Start CCC session' },
    { code: 'ccc:vote', resource: 'ccc', action: 'vote', scope: 'all', description: 'Cast vote in CCC' },
    { code: 'ccc:generate_pv', resource: 'ccc', action: 'generate_pv', scope: 'all', description: 'Generate PV (minutes)' },
    { code: 'ccc:sign_pv', resource: 'ccc', action: 'sign_pv', scope: 'all', description: 'Sign PV' },

    // --- Contract ---
    { code: 'contract:create', resource: 'contract', action: 'create', scope: 'all', description: 'Create contracts' },
    { code: 'contract:read', resource: 'contract', action: 'read', scope: 'all', description: 'View all contracts' },
    { code: 'contract:read:own_dept', resource: 'contract', action: 'read', scope: 'own_department', description: 'View own dept contracts' },
    { code: 'contract:update', resource: 'contract', action: 'update', scope: 'all', description: 'Update contracts' },
    { code: 'contract:visa_legal', resource: 'contract', action: 'visa_legal', scope: 'all', description: 'Legal visa on contracts' },
    { code: 'contract:visa_financial', resource: 'contract', action: 'visa_financial', scope: 'all', description: 'Financial visa on contracts' },
    { code: 'contract:approve', resource: 'contract', action: 'approve', scope: 'all', description: 'Final contract approval' },
    { code: 'contract:approve:own_dept', resource: 'contract', action: 'approve', scope: 'own_department', description: 'Approve own dept contracts' },
    { code: 'contract:sign', resource: 'contract', action: 'sign', scope: 'all', description: 'Sign contracts' },

    // --- Avenant ---
    { code: 'avenant:create', resource: 'avenant', action: 'create', scope: 'all', description: 'Create avenants' },
    { code: 'avenant:create:own_dept', resource: 'avenant', action: 'create', scope: 'own_department', description: 'Create avenants (own dept)' },
    { code: 'avenant:read', resource: 'avenant', action: 'read', scope: 'all', description: 'View all avenants' },
    { code: 'avenant:read:own_dept', resource: 'avenant', action: 'read', scope: 'own_department', description: 'View own dept avenants' },
    { code: 'avenant:validate_threshold', resource: 'avenant', action: 'validate_threshold', scope: 'all', description: 'Validate avenant thresholds' },
    { code: 'avenant:visa_legal', resource: 'avenant', action: 'visa_legal', scope: 'all', description: 'Legal visa on avenants' },
    { code: 'avenant:visa_financial', resource: 'avenant', action: 'visa_financial', scope: 'all', description: 'Financial visa on avenants' },
    { code: 'avenant:approve', resource: 'avenant', action: 'approve', scope: 'all', description: 'Approve avenants' },
    { code: 'avenant:approve:own_dept', resource: 'avenant', action: 'approve', scope: 'own_department', description: 'Approve own dept avenants' },

    // --- Audit ---
    { code: 'audit:read', resource: 'audit', action: 'read', scope: 'all', description: 'Read all audit logs' },
    { code: 'audit:read:own', resource: 'audit', action: 'read', scope: 'own', description: 'Read own audit trail' },
    { code: 'audit:export', resource: 'audit', action: 'export', scope: 'all', description: 'Export audit reports' },

    // --- System Config ---
    { code: 'config:manage', resource: 'config', action: 'manage', scope: 'all', description: 'Manage system configuration' },

    // --- Notification ---
    { code: 'notification:read:own', resource: 'notification', action: 'read', scope: 'own', description: 'Read own notifications' },
  ];

  const permissions = await Promise.all(
    permissionDefinitions.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      })
    )
  );

  const permMap = Object.fromEntries(permissions.map((p) => [p.code, p]));
  console.log(`  ✓ ${permissions.length} permissions seeded`);

  // ============================================================
  // 4. ROLE-PERMISSION MAPPINGS
  // ============================================================
  const rolePermissionMap: Record<string, string[]> = {
    SYS_ADMIN: [
      'user:create', 'user:read', 'user:read:own', 'user:update', 'user:update:own', 'user:delete', 'user:assign_role',
      'role:read', 'role:create', 'role:update',
      'department:read', 'department:manage',
      'project:create', 'project:read', 'project:update', 'project:delete', 'project:change_status', 'project:view_budget',
      'dtao:create', 'dtao:read_technical', 'dtao:read_commercial', 'dtao:update',
      'bid:read_technical', 'bid:read_commercial',
      'ccc:read',
      'contract:read',
      'avenant:read',
      'audit:read', 'audit:read:own', 'audit:export',
      'config:manage',
      'notification:read:own',
    ],
    INITIATOR: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:create:own_dept', 'project:read:own_dept', 'project:update:own_dept', 'project:view_budget:own_dept',
      'dtao:create:own_dept', 'dtao:read_technical:own_dept', 'dtao:update',
      'bid:read_technical:own_dept',
      'audit:read:own',
      'notification:read:own',
    ],
    PROC_OFFICER: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:create', 'project:read', 'project:update', 'project:change_status', 'project:view_budget',
      'dtao:create', 'dtao:read_commercial', 'dtao:update', 'dtao:publish',
      'bid:register', 'bid:read_commercial', 'bid:award',
      'ccc:schedule', 'ccc:read',
      'contract:create', 'contract:read', 'contract:update',
      'avenant:create', 'avenant:read',
      'audit:read:own',
      'notification:read:own',
    ],
    LEGAL_ADVISOR: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read',
      'dtao:read_commercial', 'dtao:approve',
      'ccc:read',
      'contract:read', 'contract:visa_legal',
      'avenant:read', 'avenant:visa_legal',
      'audit:read:own',
      'notification:read:own',
    ],
    CCC_PRESIDENT: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read:assigned',
      'dtao:read_technical:assigned', 'dtao:read_commercial:assigned',
      'bid:read_technical:assigned', 'bid:read_commercial:assigned',
      'bid:open_technical', 'bid:open_commercial',
      'bid:evaluate_technical', 'bid:evaluate_commercial', 'bid:award',
      'ccc:schedule', 'ccc:read:assigned', 'ccc:start_session', 'ccc:vote', 'ccc:sign_pv',
      'audit:read:own',
      'notification:read:own',
    ],
    CCC_MEMBER: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read:assigned',
      'dtao:read_technical:assigned', 'dtao:read_commercial:assigned',
      'bid:read_technical:assigned', 'bid:read_commercial:assigned',
      'bid:evaluate_technical', 'bid:evaluate_commercial',
      'ccc:read:assigned', 'ccc:vote', 'ccc:sign_pv',
      'audit:read:own',
      'notification:read:own',
    ],
    CCC_RAPPORTEUR: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read:assigned',
      'dtao:read_technical:assigned', 'dtao:read_commercial:assigned',
      'bid:read_technical:assigned', 'bid:read_commercial:assigned',
      'ccc:read:assigned', 'ccc:generate_pv', 'ccc:sign_pv',
      'audit:read:own',
      'notification:read:own',
    ],
    FINANCE_CONTROLLER: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read', 'project:view_budget',
      'dtao:read_commercial',
      'bid:read_commercial',
      'ccc:read',
      'contract:read', 'contract:visa_financial',
      'avenant:read', 'avenant:validate_threshold', 'avenant:visa_financial',
      'audit:read:own',
      'notification:read:own',
    ],
    STRUCTURE_MANAGER: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read:own_dept', 'project:approve:own_dept', 'project:view_budget:own_dept',
      'dtao:read_technical:own_dept', 'dtao:approve',
      'contract:read:own_dept', 'contract:approve:own_dept',
      'avenant:read:own_dept', 'avenant:create:own_dept', 'avenant:approve:own_dept',
      'audit:read:own',
      'notification:read:own',
    ],
    DG_APPROVER: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read', 'project:approve', 'project:view_budget',
      'dtao:read_commercial',
      'bid:read_commercial',
      'ccc:read',
      'contract:read', 'contract:approve', 'contract:sign',
      'avenant:read', 'avenant:approve',
      'audit:read:own',
      'notification:read:own',
    ],
    AUDITOR: [
      'user:read:own', 'user:update:own',
      'department:read',
      'project:read', 'project:view_budget',
      'dtao:read_technical', 'dtao:read_commercial',
      'bid:read_technical', 'bid:read_commercial',
      'ccc:read',
      'contract:read',
      'avenant:read',
      'audit:read', 'audit:read:own', 'audit:export',
      'notification:read:own',
    ],
  };

  let rpCount = 0;
  for (const [roleCode, permCodes] of Object.entries(rolePermissionMap)) {
    const role = roleMap[roleCode];
    for (const permCode of permCodes) {
      const perm = permMap[permCode];
      if (!perm) {
        console.warn(`  ⚠ Permission ${permCode} not found, skipping`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
      rpCount++;
    }
  }
  console.log(`  ✓ ${rpCount} role-permission mappings seeded`);

  // ============================================================
  // 5. DEFAULT ADMIN USER
  // ============================================================
  const adminPasswordHash = await bcrypt.hash('SonaERP@2026!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sonatrach.dz' },
    update: {},
    create: {
      employeeId: 'EMP-000001',
      email: 'admin@sonatrach.dz',
      passwordHash: adminPasswordHash,
      firstNameFr: 'Administrateur',
      lastNameFr: 'Système',
      firstNameAr: 'مدير',
      lastNameAr: 'النظام',
      departmentId: deptMap['DG'].id,
      preferredLang: 'FR',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_projectId: {
        userId: adminUser.id,
        roleId: roleMap['SYS_ADMIN'].id,
        projectId: '',
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roleMap['SYS_ADMIN'].id,
      assignedBy: adminUser.id,
    },
  });

  console.log(`  ✓ Admin user seeded (admin@sonatrach.dz)`);

  // ============================================================
  // 6. SYSTEM CONFIG (Procurement Thresholds)
  // ============================================================
  const configEntries = [
    {
      key: 'procurement_thresholds',
      value: {
        COMMANDE_SANS_CONSULT: { maxAmount: 1000000, currency: 'DZD' },
        GRE_A_GRE_SIMPLE: { maxAmount: 6000000, currency: 'DZD' },
        CONSULTATION_DIRECTE: { maxAmount: 12000000, minSuppliers: 3, currency: 'DZD' },
        APPEL_OFFRES_OUVERT: { minAmount: 12000001, currency: 'DZD' },
        NATIONAL_THRESHOLD: { amount: 100000000, currency: 'DZD' },
      },
      description: 'Procurement mode thresholds per Directive E-025/M R4',
    },
    {
      key: 'avenant_thresholds',
      value: {
        works: { maxCumulativePct: 10 },
        supplies: { maxCumulativePct: 20 },
        services: { maxCumulativePct: 20 },
      },
      description: 'Maximum cumulative avenant percentage before requiring new tender',
    },
    {
      key: 'auth_settings',
      value: {
        maxFailedLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        requiredEmailDomain: 'sonatrach.dz',
      },
      description: 'Authentication and security settings',
    },
    {
      key: 'ccc_settings',
      value: {
        defaultQuorum: 3,
        technicalWeightPct: 60,
        commercialWeightPct: 40,
      },
      description: 'CCC meeting and evaluation settings',
    },
  ];

  for (const config of configEntries) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log(`  ✓ ${configEntries.length} system config entries seeded`);

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
