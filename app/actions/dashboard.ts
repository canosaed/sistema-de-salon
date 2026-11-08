'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { appointmentHistory, appointments, clients, inventoryMovements, materials, payments, professionalSchedules, professionals, salonSettings, serviceCategories, services } from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'

export async function getDashboardData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [persistedAppointments, persistedCategories, persistedPayments, persistedServices, persistedProfessionals, persistedMaterials, persistedMovements, persistedSchedules, persistedSettings] = await Promise.all([
    db.select({ appointment: appointments, client: clients, professional: professionals })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(professionals, eq(appointments.professionalId, professionals.id))
      .where(eq(clients.userId, session.user.id)),
    db.select().from(serviceCategories),
    db.select({ payment: payments, appointment: appointments, client: clients })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .where(eq(clients.userId, session.user.id)),
    db.select().from(services).where(eq(services.isActive, true)),
    db.select().from(professionals).where(eq(professionals.isActive, true)),
    db.select().from(materials).where(eq(materials.isActive, true)),
    db.select().from(inventoryMovements),
    db.select().from(professionalSchedules).where(eq(professionalSchedules.isActive, true)),
    db.select().from(salonSettings).limit(1),
  ])
  const dashboardPayments = persistedPayments.map(({ payment, client }) => ({
    id: payment.id,
    appointmentId: payment.appointmentId,
    clientName: client.name,
    amount: Number(payment.amount),
    method: payment.method,
    type: payment.type,
    status: payment.status,
    notes: payment.notes || '',
    createdAt: payment.createdAt.toISOString(),
  }))


  const dashboardAppointments = [
    ...salonRepo.getAppointments(),
    ...persistedAppointments.map(({ appointment, client, professional }) => ({
      id: appointment.id,
      clientId: appointment.clientId,
      clientName: client.name,
      clientPhone: client.phone,
      serviceName: 'Reserva online',
      date: appointment.startDateTime?.toISOString().slice(0, 10) || '',
      time: appointment.startDateTime?.toISOString().slice(11, 16) || '',
      professionalId: appointment.professionalId,
      professionalName: professional.name,
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
      isPublicBooking: appointment.isPublicBooking,
      notes: appointment.notes || 'Reserva online',
      totalDurationMinutes: appointment.totalDurationMinutes,
      totalPrice: Number(appointment.totalPrice),
      requiredDeposit: Number(appointment.requiredDeposit),
      createdAt: appointment.createdAt.toISOString(),
    })),
  ]

  return {
    categories: persistedCategories.length ? persistedCategories : salonRepo.getCategories(),
    services: persistedServices.length ? persistedServices : salonRepo.getServices(),
    techniques: salonRepo.getTechniques(),
    materials: persistedMaterials.length ? persistedMaterials : salonRepo.getMaterials(),
    professionals: persistedProfessionals.length ? persistedProfessionals : salonRepo.getProfessionals(),
    clients: salonRepo.getClients(),
    appointments: dashboardAppointments,
    payments: dashboardPayments.length ? dashboardPayments : salonRepo.getPayments(),
    inventoryMovements: persistedMovements.length ? persistedMovements : salonRepo.getInventoryMovements(),
    settings: persistedSettings[0] || salonRepo.getSettings(),
    schedules: persistedSchedules.length ? persistedSchedules : salonRepo.getAllSchedules(),
  }
}

export async function createInternalAppointment(input: {
  clientId?: string
  clientName: string
  clientPhone: string
  serviceIds: string[]
  techniqueIds?: string[]
  professionalId: string
  date: string
  time: string
  notes?: string
  initialDepositAmount?: number
  paymentMethod?: 'cash' | 'transfer' | 'card' | 'other'
}) {
  const appointment = salonRepo.createAppointment({
    clientId: input.clientId,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    serviceIds: input.serviceIds,
    techniqueIds: input.techniqueIds,
    professionalId: input.professionalId,
    date: input.date,
    time: input.time,
    notes: input.notes,
    isPublicBooking: false,
  })

  // Si se registró una seña en el mismo acto de reserva interna:
  if (input.initialDepositAmount && input.initialDepositAmount > 0) {
    salonRepo.registerPayment({
      appointmentId: appointment.id,
      amount: input.initialDepositAmount,
      method: input.paymentMethod || 'cash',
      type: 'deposit',
      notes: 'Seña inicial al crear turno interno',
    })
  }

  return appointment
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: 'pending_confirmation' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
  reason?: string
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [appointment] = await db.update(appointments).set({ status, updatedAt: new Date() }).where(eq(appointments.id, appointmentId)).returning()
  if (!appointment) return salonRepo.updateAppointmentStatus(appointmentId, status, reason)
  await db.insert(appointmentHistory).values({ id: crypto.randomUUID(), appointmentId, action: `status:${status}`, actorUserId: session.user.id, details: reason || null, snapshot: appointment })
  return appointment
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newDate: string,
  newTime: string
) {
  return salonRepo.rescheduleAppointment(appointmentId, newDate, newTime)
}

export async function deleteAppointmentAction(appointmentId: string) {
  return salonRepo.deleteAppointment(appointmentId)
}

export async function registerAppointmentPaymentAction(input: {
  appointmentId: string
  amount: number
  method: 'cash' | 'transfer' | 'card' | 'other'
  type: 'deposit' | 'partial' | 'full' | 'refund'
  notes?: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El importe debe ser mayor a 0.')
  const [payment] = await db.insert(payments).values({ id: crypto.randomUUID(), appointmentId: input.appointmentId, amount: String(input.amount), method: input.method, type: input.type, status: 'completed', notes: input.notes?.trim() || null }).returning()
  await db.update(appointments).set({ paymentStatus: input.type === 'full' ? 'paid' : 'partial', updatedAt: new Date() }).where(eq(appointments.id, input.appointmentId))
  return { payment: { ...payment, amount: Number(payment.amount), clientName: '', createdAt: payment.createdAt.toISOString() }, balance: { paymentStatus: input.type === 'full' ? 'paid' : 'partial' } }
}

export async function recordMaterialConsumptionAction(input: {
  materialId: string
  type: 'in' | 'out' | 'adjustment' | 'waste'
  quantity: number
  reason: string
  appointmentId?: string
}) {
  return salonRepo.registerMaterialMovement(input)
}
