import { getPublicBookingCatalog } from '@/app/actions/booking'
import PublicBookingClient from '@/components/public-booking-client'

export const metadata = {
  title: 'Reservar Turno Online | Atelier Beauty Studio',
  description: 'Sistema de reserva online de turnos para manicuría, pedicuría, esculpidas y pestañas.',
}

export default async function ReservarPage() {
  const catalog = await getPublicBookingCatalog()
  return (
    <main className="booking-page-layout">
      <PublicBookingClient initialCatalog={catalog} />
    </main>
  )
}
