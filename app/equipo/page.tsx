import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import TeamInvitations from '@/components/team-invitations'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [account] = await db.select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!account?.isActive || account.role !== 'admin') redirect('/')

  const users = await db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }).from(user).orderBy(user.createdAt, user.name)

  return <TeamInvitations initialUsers={users} currentUserId={session.user.id} />
}
