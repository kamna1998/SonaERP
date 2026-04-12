export const SONATRACH_COLORS = {
  navy: '#002244',
  navyLight: '#003366',
  navyDark: '#001122',
  orange: '#FF7900',
  orangeLight: '#FF9933',
} as const;

export const ROLE_LABELS: Record<string, { fr: string; ar: string; en: string }> = {
  SYS_ADMIN: { fr: 'Administrateur', ar: 'مدير النظام', en: 'Administrator' },
  INITIATOR: { fr: 'Initiateur', ar: 'المبادر', en: 'Initiator' },
  PROC_OFFICER: { fr: 'Chargé de Passation', ar: 'مسؤول المناقصات', en: 'Procurement Officer' },
  LEGAL_ADVISOR: { fr: 'Conseiller Juridique', ar: 'المستشار القانوني', en: 'Legal Advisor' },
  CCC_PRESIDENT: { fr: 'Président CCC', ar: 'رئيس اللجنة', en: 'CCC President' },
  CCC_MEMBER: { fr: 'Membre CCC', ar: 'عضو اللجنة', en: 'CCC Member' },
  CCC_RAPPORTEUR: { fr: 'Rapporteur CCC', ar: 'مقرر اللجنة', en: 'CCC Rapporteur' },
  FINANCE_CONTROLLER: { fr: 'Contrôleur Financier', ar: 'المراقب المالي', en: 'Finance Controller' },
  STRUCTURE_MANAGER: { fr: 'Responsable Structure', ar: 'مسؤول الهيكل', en: 'Structure Manager' },
  DG_APPROVER: { fr: 'Approbateur DG', ar: 'المصادق', en: 'DG Approver' },
  AUDITOR: { fr: 'Auditeur', ar: 'المدقق', en: 'Auditor' },
};
