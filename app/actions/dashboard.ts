'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { appointments, clients, professionals } from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'

export async function getDashboardData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const persistedAppointments = await db.select({ appointment: appointments, client: clients, professional: professionals })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(professionals, eq(appointments.professionalId, professionals.id))
    .where(eq(clients.userId, session.user.id))
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
    categories: salonRepo.getCategories(),
    services: salonRepo.getServices(),
    techniques: salonRepo.getTechniques(),
    materials: salonRepo.getMaterials(),
    professionals: salonRepo.getProfessionals(),
    clients: salonRepo.getClients(),
    appointments: dashboardAppointments,
    payments: salonRepo.getPayments(),
    inventoryMovements: salonRepo.getInventoryMovements(),
    settings: salonRepo.getSettings(),
    schedules: salonRepo.getAllSchedules(),
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
  return salonRepo.updateAppointmentStatus(appointmentId, status, reason)
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
  return salonRepo.registerPayment(input)
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
