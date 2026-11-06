'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'

export async function getAppointments() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  return db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, session.user.id))
    .orderBy(desc(appointments.appointmentDate), desc(appointments.appointmentTime))
}

export async function createAppointment(input: {
  client: string
  service: string
  appointmentDate: string
  appointmentTime: string
  professional: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const values = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    client: input.client.trim(),
    service: input.service.trim(),
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    professional: input.professional.trim(),
    status: 'Pendiente',
  }

  if (!values.client || !values.service || !values.professional || !values.appointmentDate) {
    throw new Error('Missing required appointment fields')
  }

  await db.insert(appointments).values(values)
  revalidatePath('/')
  return values
}
