'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  appointmentHistory,
  appointments,
  clients,
  inventoryMovements,
  materials,
  payments,
  professionalSchedules,
  professionals,
  salonSettings,
  serviceCategories,
  services,
  techniques,
} from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'
import { registerStockMovementAction } from '@/app/actions/inventory'

export async function getDashboardData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const [
    persistedAppointments,
    persistedCategories,
    persistedPayments,
    persistedServices,
    persistedProfessionals,
    persistedMaterials,
    persistedMovements,
    persistedSchedules,
    persistedSettings,
    persistedClients,
    persistedTechniques,
  ] = await Promise.all([
    db
      .select({ appointment: appointments, client: clients, professional: professionals })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(professionals, eq(appointments.professionalId, professionals.id))
      .where(eq(clients.userId, session.user.id)),
    db.select().from(serviceCategories),
    db
      .select({ payment: payments, appointment: appointments, client: clients })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .where(eq(clients.userId, session.user.id)),
    db.select().from(services).where(eq(services.isActive, true)),
    db.select().from(techniques).where(eq(techniques.isActive, true)),
    db.select().from(professionals).where(eq(professionals.isActive, true)),
    db.select().from(materials).where(eq(materials.isActive, true)),
    db.select().from(inventoryMovements),
    db.select().from(professionalSchedules).where(eq(professionalSchedules.isActive, true)),
    db.select().from(salonSettings).limit(1),
    db.select().from(clients).where(eq(clients.userId, session.user.id)),
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

  const persistedIds = new Set(persistedAppointments.map((p) => p.appointment.id))
  const memoryAppointments = salonRepo
    .getAppointments()
    .filter((a) => !persistedIds.has(a.id))

  const dashboardAppointments = [
    ...memoryAppointments,
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
      notes: appointment.notes || '',
      totalDurationMinutes: appointment.totalDurationMinutes,
      totalPrice: Number(appointment.totalPrice),
      requiredDeposit: Number(appointment.requiredDeposit),
      createdAt: appointment.createdAt.toISOString(),
    })),
  ]

  return {
    categories: persistedCategories.length ? persistedCategories : salonRepo.getCategories(),
    services: persistedServices.length ? persistedServices : salonRepo.getServices(),
    techniques: persistedTechniques.length ? persistedTechniques : salonRepo.getTechniques(),
    materials: persistedMaterials.length ? persistedMaterials : salonRepo.getMaterials(),
    professionals: persistedProfessionals.length ? persistedProfessionals : salonRepo.getProfessionals(),
    clients: persistedClients.length ? persistedClients : salonRepo.getClients(),
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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // 1. Crear y sincronizar en el motor de negocio
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

  // 2. Persistir en PostgreSQL directamente
  const startDateTime = new Date(`${input.date}T${input.time}:00`)
  const endDateTime = new Date(startDateTime.getTime() + appointment.totalDurationMinutes * 60_000)

  // Asegurar que el cliente exista en PostgreSQL
  const cleanPhone = input.clientPhone.trim()
  const existingClients = await db.select().from(clients).where(eq(clients.phone, cleanPhone)).limit(1)
  let dbClientId = existingClients[0]?.id
  if (!dbClientId) {
    dbClientId = appointment.clientId || crypto.randomUUID()
    await db.insert(clients).values({
      id: dbClientId,
      userId: session.user.id,
      name: input.clientName.trim(),
      phone: cleanPhone,
      notes: input.notes?.trim() || null,
      visits: 1,
    })
  }

  await db.insert(appointments).values({
    id: appointment.id,
    clientId: dbClientId,
    professionalId: input.professionalId,
    startDateTime,
    endDateTime,
    totalDurationMinutes: appointment.totalDurationMinutes,
    totalPrice: String(appointment.totalPrice),
    requiredDeposit: String(appointment.requiredDeposit),
    status: 'confirmed',
    paymentStatus: input.initialDepositAmount && input.initialDepositAmount > 0 ? 'deposit_paid' : 'pending',
    notes: input.notes || 'Turno interno',
    isPublicBooking: false,
  })

  // Historial de auditoría
  await db.insert(appointmentHistory).values({
    id: crypto.randomUUID(),
    appointmentId: appointment.id,
    action: 'created_internal',
    actorUserId: session.user.id,
    details: `Turno agendado en recepción para ${input.clientName}`,
  })

  // 3. Si se registró una seña en el mismo acto de reserva interna:
  if (input.initialDepositAmount && input.initialDepositAmount > 0) {
    const paymentRecord = salonRepo.registerPayment({
      appointmentId: appointment.id,
      amount: input.initialDepositAmount,
      method: input.paymentMethod || 'cash',
      type: 'deposit',
      notes: 'Seña inicial al crear turno interno',
    })

    await db.insert(payments).values({
      id: paymentRecord.payment.id,
      appointmentId: appointment.id,
      amount: String(input.initialDepositAmount),
      method: input.paymentMethod || 'cash',
      type: 'deposit',
      status: 'completed',
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

  // Actualizar en PostgreSQL
  const [appointment] = await db
    .update(appointments)
    .set({ status, updatedAt: new Date(), ...(reason && { cancellationReason: reason }) })
    .where(eq(appointments.id, appointmentId))
    .returning()

  // Sincronizar también con la capa en memoria / motor de negocio
  try {
    salonRepo.updateAppointmentStatus(appointmentId, status, reason)
  } catch {
    // Si no estaba en memoria, continúa con el persistido
  }

  if (appointment) {
    await db.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: `status:${status}`,
      actorUserId: session.user.id,
      details: reason || null,
      snapshot: appointment,
    })
    return appointment
  }

  return salonRepo.updateAppointmentStatus(appointmentId, status, reason)
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newDate: string,
  newTime: string
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const [existing] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1)

  // Sincronizar repositorio en memoria si existe allí
  let repoApt: any = null
  try {
    repoApt = salonRepo.rescheduleAppointment(appointmentId, newDate, newTime)
  } catch {
    // no-op si era únicamente persistido
  }

  if (!existing?.startDateTime || !existing.endDateTime) {
    return repoApt
  }

  const duration = existing.endDateTime.getTime() - existing.startDateTime.getTime()
  const startDateTime = new Date(`${newDate}T${newTime}:00`)
  const endDateTime = new Date(startDateTime.getTime() + duration)

  const [updated] = await db
    .update(appointments)
    .set({ startDateTime, endDateTime, updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning()

  await db.insert(appointmentHistory).values({
    id: crypto.randomUUID(),
    appointmentId,
    action: 'rescheduled',
    actorUserId: session.user.id,
    details: `${newDate} ${newTime}`,
    snapshot: updated,
  })

  return {
    ...updated,
    date: newDate,
    time: newTime,
    startMinutes: (startDateTime.getHours() * 60) + startDateTime.getMinutes(),
    endMinutes: (endDateTime.getHours() * 60) + endDateTime.getMinutes(),
    totalDurationMinutes: Math.round(duration / 60000),
    totalPrice: Number(updated.totalPrice),
    requiredDeposit: Number(updated.requiredDeposit),
  }
}

export async function deleteAppointmentAction(appointmentId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  // Cancelación / Baja lógica en DB
  const [updated] = await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning()

  try {
    salonRepo.deleteAppointment(appointmentId)
  } catch {
    // no-op
  }

  if (updated) {
    await db.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: 'cancelled',
      actorUserId: session.user.id,
      snapshot: updated,
    })
    return updated
  }

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

  const [payment] = await db
    .insert(payments)
    .values({
      id: crypto.randomUUID(),
      appointmentId: input.appointmentId,
      amount: String(input.amount),
      method: input.method,
      type: input.type,
      status: 'completed',
      notes: input.notes?.trim() || null,
    })
    .returning()

  // Recalcular saldo total sumando todos los pagos del turno en la base de datos
  const allPayments = await db.select().from(payments).where(eq(payments.appointmentId, input.appointmentId))
  const [targetAppointment] = await db.select().from(appointments).where(eq(appointments.id, input.appointmentId)).limit(1)

  let paymentStatus: 'pending' | 'deposit_paid' | 'partially_paid' | 'paid' | 'refunded' = 'pending'
  if (targetAppointment) {
    const totalPrice = Number(targetAppointment.totalPrice)
    let totalPaid = 0
    for (const p of allPayments) {
      const amt = Number(p.amount)
      if (p.type === 'refund') totalPaid -= amt
      else totalPaid += amt
    }

    if (totalPaid <= 0 && allPayments.some((p) => p.type === 'refund')) paymentStatus = 'refunded'
    else if (totalPaid >= totalPrice && totalPrice > 0) paymentStatus = 'paid'
    else if (totalPaid > 0 && totalPaid < totalPrice) {
      const hasDeposit = allPayments.some((p) => p.type === 'deposit')
      paymentStatus = hasDeposit ? 'deposit_paid' : 'partially_paid'
    }

    await db.update(appointments).set({ paymentStatus, updatedAt: new Date() }).where(eq(appointments.id, input.appointmentId))
  }

  // Sincronizar en repositorio de memoria
  try {
    salonRepo.registerPayment(input)
  } catch {
    // no-op
  }

  return {
    payment: {
      ...payment,
      amount: Number(payment.amount),
      clientName: '',
      createdAt: payment.createdAt.toISOString(),
    },
    balance: { paymentStatus },
  }
}

export async function recordMaterialConsumptionAction(input: {
  materialId: string
  type: 'in' | 'out' | 'adjustment' | 'waste'
  quantity: number
  reason: string
  appointmentId?: string
}) {
  const result = await registerStockMovementAction(input)
  if (!result.success) throw new Error(result.error)
  return result
}
