export const ROLES = ["owner", "manager", "receptionist", "warehouse", "field", "technician", "accountant", "readonly"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "org.manage",
  "members.manage",
  "billing.manage",
  "inventory.read",
  "inventory.write",
  "units.status",
  "customers.read",
  "customers.write",
  "reservations.read",
  "reservations.write",
  "reservations.cancel",
  "maintenance.write",
  "finance.read",
  "reports.read",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: ALL,
  manager: new Set(PERMISSIONS.filter((p) => p !== "billing.manage" && p !== "org.manage")),
  receptionist: new Set<Permission>([
    "inventory.read", "units.status", "customers.read", "customers.write",
    "reservations.read", "reservations.write", "reservations.cancel",
  ]),
  warehouse: new Set<Permission>(["inventory.read", "inventory.write", "units.status", "reservations.read", "customers.read"]),
  field: new Set<Permission>(["inventory.read", "units.status", "reservations.read", "customers.read"]),
  technician: new Set<Permission>(["inventory.read", "units.status", "maintenance.write", "reservations.read"]),
  accountant: new Set<Permission>(["inventory.read", "customers.read", "reservations.read", "finance.read", "reports.read", "audit.read"]),
  readonly: new Set<Permission>(["inventory.read", "customers.read", "reservations.read", "reports.read"]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}
