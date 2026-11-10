export const panelRoles = ['admin', 'receptionist'] as const
export const adminRoles = ['admin'] as const
export type SalonRole = 'admin' | 'receptionist' | 'professional'

export function isSalonRoleAllowed(
  role: string,
  allowedRoles: readonly string[] = panelRoles,
): role is SalonRole {
  return (role === 'admin' || role === 'receptionist' || role === 'professional') &&
    allowedRoles.includes(role)
}
