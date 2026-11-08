import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getClients } from '@/app/actions/clients'
import DashboardClient from '@/components/dashboard-client'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const clients = await getClients()
  return <DashboardClient initialClients={clients} />
}
