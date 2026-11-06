import DashboardClient from '@/components/dashboard-client'
import { getDashboardData } from '@/app/actions/dashboard'

export default async function Page() {
  const data = await getDashboardData()
  return <DashboardClient initialData={data} />
}
