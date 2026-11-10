import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { isSalonRoleAllowed, panelRoles } from '@/lib/role-policy'
export { adminRoles, panelRoles, type SalonRole } from '@/lib/role-policy'

export async function requireSalonRole(allowedRoles: readonly string[] = panelRoles) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [account] = await db.select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!account || !account.isActive || !isSalonRoleAllowed(account.role, allowedRoles)) {
    throw new Error('Forbidden')
  }
  return { ...session.user, role: account.role }
}
