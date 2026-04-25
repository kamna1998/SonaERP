export interface Permission {
  id: string;
  code: string;
  resource: string;
  action: string;
  scope?: string;
  description?: string;
}

export interface RoleWithPermissions {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  permissions: Permission[];
}
