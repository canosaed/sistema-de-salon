import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import DashboardClient from '@/components/dashboard-client'
import { getDashboardData } from '@/app/actions/dashboard'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [account] = await db.select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!account?.isActive || !['admin', 'receptionist'].includes(account.role)) redirect('/no-access')

  const data = await getDashboardData()
  return <DashboardClient initialData={data} />
}
