'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { appointments } from '@/lib/db/schema'

export async function createAppointment(input: {
  client: string
  service: string
  appointmentDate: string
  appointmentTime: string
  professional: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const client = input.client.trim()
  const service = input.service.trim()
  const professional = input.professional.trim()
  if (!client || !service || !professional || !input.appointmentDate || !input.appointmentTime) {
    throw new Error('Missing required appointment fields')
  }

  const appointmentDate = new Date(`${input.appointmentDate}T00:00:00`)
  if (Number.isNaN(appointmentDate.getTime()) || appointmentDate < new Date(new Date().toDateString())) {
    throw new Error('Appointment date cannot be in the past')
  }

  const existing = await db.select({ id: appointments.id }).from(appointments).where(and(
    eq(appointments.userId, session.user.id),
    eq(appointments.appointmentDate, input.appointmentDate),
    eq(appointments.appointmentTime, input.appointmentTime),
    eq(appointments.professional, professional),
    eq(appointments.status, 'Pendiente'),
  )).limit(1)

  if (existing.length > 0) throw new Error('This professional is already booked at that time')

  const record = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    client,
    service,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    professional,
    status: 'Pendiente',
  }

  await db.insert(appointments).values(record)
  return record
}
