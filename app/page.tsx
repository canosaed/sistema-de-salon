import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import DashboardClient from '@/components/dashboard-client'
import { getDashboardData } from '@/app/actions/dashboard'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const data = await getDashboardData()
  return <DashboardClient initialData={data} />
}
