import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getAppointments } from '@/app/actions/appointments'
import DashboardShell from '@/components/dashboard-shell'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/sign-in')
  }

  const savedAppointments = await getAppointments()
  const appointmentCards = savedAppointments.map((appointment, index) => ({
    time: appointment.appointmentTime,
    client: appointment.client,
    service: appointment.service,
    professional: appointment.professional,
    status: appointment.status,
    color: ['bg-[#e4c3b7]', 'bg-[#d8c8e8]', 'bg-[#bfd8d2]', 'bg-[#ead5a8]'][index % 4],
  }))

  return <DashboardShell initialAppointments={appointmentCards} />
}
