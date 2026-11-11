'use server'

import { and, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminRoles, panelRoles, requireSalonRole } from '@/lib/staff-auth'
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  clients,
  inventoryMovements,
  materials,
  payments,
  professionalAbsences,
  professionalSchedules,
  professionalServices,
  professionals,
  scheduleBlocks,
  salonSettings,
  serviceCategories,
  services,
  techniques,
} from '@/lib/db/schema'
import { registerStockMovementAction } from '@/app/actions/inventory'
import { calculateAppointmentTotals, calculateAvailableSlots, parseTimeToMinutes } from '@/lib/business-logic'
import { SALON_TIME_ZONE } from '@/lib/salon-time'

const activeAppointmentStatuses = ['pending_confirmation', 'confirmed', 'waiting', 'in_progress']

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function toWallClockDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes))
}

function toDayMinutes(value: Date, dayStart: Date) {
  return Math.floor((value.getTime() - dayStart.getTime()) / 60_000)
}

function getNowInSalonWallClock() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ))
}

export async function getDashboardData() {
  const sessionUser = await requireSalonRole(panelRoles)
  if (sessionUser.role !== 'admin' && sessionUser.role !== 'receptionist') {
    throw new Error('Forbidden')
  }
  const role = sessionUser.role
  const isAdmin = role === 'admin'
  const [
    persistedAppointments,
    persistedAppointmentServices,
    persistedAppointmentHistory,
    persistedCategories,
    persistedPayments,
    persistedServices,
    persistedTechniques,
    persistedProfessionals,
    persistedMaterials,
    persistedMovements,
    persistedSchedules,
    persistedSettings,
    persistedClients,
  ] = await Promise.all([
    db
      .select({ appointment: appointments, client: clients, professional: professionals })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(professionals, eq(appointments.professionalId, professionals.id)),
    db.select().from(appointmentServices),
    db.select().from(appointmentHistory),
    db.select().from(serviceCategories),
    db
      .select({ payment: payments, appointment: appointments, client: clients })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .innerJoin(clients, eq(appointments.clientId, clients.id)),
    db.select().from(services).where(eq(services.isActive, true)),
    db.select().from(techniques).where(eq(techniques.isActive, true)),
    db.select().from(professionals).where(eq(professionals.isActive, true)),
    db.select().from(materials).where(eq(materials.isActive, true)),
    db.select().from(inventoryMovements),
    db.select().from(professionalSchedules).where(eq(professionalSchedules.isActive, true)),
    db.select().from(salonSettings).limit(1),
    db.select().from(clients).where(eq(clients.isActive, true)),
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
    ...persistedAppointments.map(({ appointment, client, professional }) => ({
      id: appointment.id,
      clientId: appointment.clientId,
      clientName: client.name,
      clientPhone: client.phone,
      serviceName: persistedAppointmentServices
        .filter((item) => item.appointmentId === appointment.id)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((item) => item.historicServiceName)
        .join(' + ') || 'Reserva online',
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
      history: persistedAppointmentHistory
        .filter((entry) => entry.appointmentId === appointment.id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((entry) => ({
          action: entry.action,
          details: entry.details || '',
          createdAt: entry.createdAt.toISOString(),
        })),
    })),
  ]

  return {
    categories: persistedCategories,
    services: persistedServices,
    techniques: persistedTechniques,
    materials: isAdmin ? persistedMaterials : [],
    professionals: persistedProfessionals,
    clients: persistedClients,
    appointments: dashboardAppointments,
    payments: dashboardPayments,
    inventoryMovements: isAdmin ? persistedMovements : [],
    settings: isAdmin ? persistedSettings[0] ?? null : null,
    schedules: persistedSchedules,
    role,
    currentUser: {
      name: sessionUser.name,
      email: sessionUser.email,
    },
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
  const sessionUser = await requireSalonRole(panelRoles)
  const clientName = input.clientName.trim()
  const clientPhone = input.clientPhone.trim()
  if (!clientName || !clientPhone) throw new Error('El nombre y teléfono de la clienta son obligatorios.')
  if (!isValidDate(input.date) || !/^\d{2}:\d{2}$/.test(input.time) ||
      Number(input.time.slice(0, 2)) > 23 || Number(input.time.slice(3)) > 59) {
    throw new Error('La fecha o el horario del turno no son válidos.')
  }
  if (!input.serviceIds.length || !input.professionalId) throw new Error('Seleccione servicios y una profesional.')
  if (input.initialDepositAmount !== undefined &&
      (!Number.isFinite(input.initialDepositAmount) || input.initialDepositAmount < 0)) {
    throw new Error('El importe de la seña debe ser un valor válido.')
  }

  const [serviceRows, professional] = await Promise.all([
    db.select().from(services).where(and(inArray(services.id, input.serviceIds), eq(services.isActive, true))),
    db.select().from(professionals).where(and(eq(professionals.id, input.professionalId), eq(professionals.isActive, true))).then((rows) => rows[0]),
  ])
  const serviceById = new Map(serviceRows.map((service) => [service.id, service]))
  if (serviceById.size !== input.serviceIds.length) throw new Error('Uno o más servicios no existen o están inactivos.')
  const selectedServices = input.serviceIds.map((id) => {
    const service = serviceById.get(id)
    if (!service) throw new Error('Servicio no encontrado o inactivo.')
    return service
  })
  if (!professional) throw new Error('La profesional no existe o está inactiva.')

  const techniqueRows = input.techniqueIds?.length
    ? await db.select().from(techniques).where(and(inArray(techniques.id, input.techniqueIds), eq(techniques.isActive, true)))
    : []
  const techniqueById = new Map(techniqueRows.map((technique) => [technique.id, technique]))
  const items = selectedServices.map((service, index) => {
    if (!service) throw new Error('Servicio no encontrado.')
    const techniqueId = input.techniqueIds?.[index]
    const technique = techniqueId ? techniqueById.get(techniqueId) : undefined
    if (techniqueId && (!technique || technique.serviceId !== service.id)) {
      throw new Error('Una técnica seleccionada no corresponde al servicio.')
    }
    return {
      serviceId: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      prepMinutes: service.prepMinutes,
      cleanupMinutes: service.cleanupMinutes,
      price: Number(service.price),
      techniqueId: technique?.id,
      techniqueName: technique?.name,
      additionalMinutes: technique?.additionalMinutes ?? 0,
      additionalPrice: Number(technique?.additionalPrice ?? 0),
    }
  })
  const totals = calculateAppointmentTotals(items)
  const primaryService = selectedServices[0]
  if (!primaryService) throw new Error('Seleccione al menos un servicio.')
  const requiredDeposit = primaryService.depositType === 'fixed'
    ? Number(primaryService.depositValue)
    : Math.round(totals.totalPrice * Number(primaryService.depositValue) / 100)
  const initialDepositAmount = input.initialDepositAmount ?? 0
  if (initialDepositAmount > totals.totalPrice) throw new Error('La seña no puede superar el precio total del turno.')

  const serviceLinks = await db.select().from(professionalServices)
    .where(and(eq(professionalServices.professionalId, professional.id), inArray(professionalServices.serviceId, input.serviceIds)))
  if (new Set(serviceLinks.map(({ serviceId }) => serviceId)).size !== input.serviceIds.length) {
    throw new Error('La profesional seleccionada no está habilitada para todos los servicios.')
  }

  const appointmentId = crypto.randomUUID()
  const startDateTime = toWallClockDate(input.date, input.time)
  const endDateTime = new Date(startDateTime.getTime() + totals.totalOccupiedDurationMinutes * 60_000)
  const dayStart = toWallClockDate(input.date, '00:00')
  const dayOfWeek = new Date(dayStart).getUTCDay()
  if (startDateTime <= getNowInSalonWallClock()) throw new Error('No es posible crear turnos en horarios pasados.')

  let persistedClientId = ''
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${professional.id}), hashtext('appointments'))`)
    const [schedule] = await tx.select().from(professionalSchedules).where(and(
      eq(professionalSchedules.professionalId, professional.id),
      eq(professionalSchedules.dayOfWeek, dayOfWeek),
      eq(professionalSchedules.isActive, true),
    )).limit(1)
    if (!schedule) throw new Error('La profesional no trabaja en la fecha seleccionada.')

    const absences = await tx.select().from(professionalAbsences).where(and(
      eq(professionalAbsences.professionalId, professional.id),
      lte(professionalAbsences.startDate, input.date),
      gte(professionalAbsences.endDate, input.date),
    ))
    const blocks = await tx.select().from(scheduleBlocks).where(and(
      lt(scheduleBlocks.startDateTime, new Date(dayStart.getTime() + 24 * 60 * 60_000)),
      gt(scheduleBlocks.endDateTime, dayStart),
      or(eq(scheduleBlocks.professionalId, professional.id), isNull(scheduleBlocks.professionalId)),
    ))
    const booked = await tx.select().from(appointments).where(and(
      eq(appointments.professionalId, professional.id),
      inArray(appointments.status, activeAppointmentStatuses),
      lt(appointments.startDateTime, endDateTime),
      gt(appointments.endDateTime, startDateTime),
    ))
    const slots = calculateAvailableSlots({
      dateStr: input.date,
      schedule,
      absences: absences.map(({ startDate, endDate }) => ({ startDate, endDate })),
      blocks: blocks.map((block) => ({
        startMinutes: toDayMinutes(block.startDateTime, dayStart),
        endMinutes: toDayMinutes(block.endDateTime, dayStart),
      })),
      existingAppointments: booked.map((appointment) => ({
        startMinutes: toDayMinutes(appointment.startDateTime, dayStart),
        endMinutes: toDayMinutes(appointment.endDateTime, dayStart),
        status: appointment.status,
      })),
      totalDurationMinutes: totals.totalOccupiedDurationMinutes,
    })
    if (!slots.includes(input.time)) throw new Error('El horario no está disponible según la agenda de la profesional.')

    const existingClient = input.clientId
      ? (await tx.select().from(clients).where(and(eq(clients.id, input.clientId), eq(clients.isActive, true))).limit(1))[0]
      : (await tx.select().from(clients).where(eq(clients.phone, clientPhone)).limit(1))[0]
    if (input.clientId && !existingClient) throw new Error('La clienta seleccionada no existe o está inactiva.')
    const clientId = existingClient?.id ?? crypto.randomUUID()
    persistedClientId = clientId
    if (!existingClient) {
      await tx.insert(clients).values({
        id: clientId,
        userId: sessionUser.id,
        name: clientName,
        phone: clientPhone,
        visits: 0,
      })
    }

    await tx.insert(appointments).values({
      id: appointmentId,
      clientId,
      professionalId: professional.id,
      startDateTime,
      endDateTime,
      totalDurationMinutes: totals.totalOccupiedDurationMinutes,
      totalPrice: totals.totalPrice.toFixed(2),
      requiredDeposit: requiredDeposit.toFixed(2),
      status: 'confirmed',
      paymentStatus: initialDepositAmount >= totals.totalPrice && totals.totalPrice > 0
        ? 'paid'
        : initialDepositAmount > 0 ? 'deposit_paid' : 'pending',
      notes: input.notes?.trim() || 'Turno interno',
      isPublicBooking: false,
    })
    await tx.insert(appointmentServices).values(items.map((item, index) => ({
      id: crypto.randomUUID(),
      appointmentId,
      serviceId: item.serviceId,
      techniqueId: item.techniqueId ?? null,
      historicServiceName: item.name,
      historicTechniqueName: item.techniqueName ?? null,
      historicPrice: (item.price + (item.additionalPrice ?? 0)).toFixed(2),
      historicDurationMinutes: item.durationMinutes + (item.additionalMinutes ?? 0),
      historicPrepMinutes: item.prepMinutes ?? 0,
      historicCleanupMinutes: item.cleanupMinutes ?? 0,
      sequenceOrder: index + 1,
    })))
    await tx.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: 'created_internal',
      actorUserId: sessionUser.id,
      details: `Turno agendado para ${clientName}`,
    })
    if (initialDepositAmount > 0) {
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        appointmentId,
        amount: initialDepositAmount.toFixed(2),
        method: input.paymentMethod || 'cash',
        type: 'deposit',
        status: 'completed',
        notes: 'Seña inicial al crear turno interno',
      })
    }
  })

  return {
    id: appointmentId,
    clientId: persistedClientId,
    professionalId: professional.id,
    clientName,
    clientPhone,
    serviceName: items.map(({ name }) => name).join(' + '),
    date: input.date,
    time: input.time,
    startMinutes: parseTimeToMinutes(input.time),
    endMinutes: parseTimeToMinutes(input.time) + totals.totalOccupiedDurationMinutes,
    totalDurationMinutes: totals.totalOccupiedDurationMinutes,
    totalPrice: totals.totalPrice,
    requiredDeposit,
    status: 'confirmed',
    paymentStatus: initialDepositAmount >= totals.totalPrice && totals.totalPrice > 0
      ? 'paid'
      : initialDepositAmount > 0 ? 'deposit_paid' : 'pending',
    notes: input.notes || 'Turno interno',
    isPublicBooking: false,
    createdAt: new Date().toISOString(),
  }
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  status: 'pending_confirmation' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
  reason?: string
) {
  const sessionUser = await requireSalonRole(panelRoles)
  if (!appointmentId) throw new Error('ID de turno no provisto.')

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)
      .for('update')
    if (!existing) throw new Error('Turno no encontrado.')

    await tx.select({ id: clients.id }).from(clients)
      .where(eq(clients.id, existing.clientId))
      .limit(1)
      .for('update')

    const [appointment] = await tx.update(appointments)
      .set({
        status,
        updatedAt: new Date(),
        ...(reason !== undefined && { cancellationReason: reason }),
        ...(status === 'cancelled' && { cancelledAt: new Date() }),
      })
      .where(eq(appointments.id, appointmentId))
      .returning()
    if (!appointment) throw new Error('Turno no encontrado.')

    if (existing.status === 'completed' || status === 'completed') {
      const [completedVisits] = await tx.select({
        count: sql<number>`count(*)::int`,
      }).from(appointments).where(and(
        eq(appointments.clientId, existing.clientId),
        eq(appointments.status, 'completed'),
      ))
      await tx.update(clients)
        .set({ visits: completedVisits.count, updatedAt: new Date() })
        .where(eq(clients.id, existing.clientId))
    }

    await tx.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: `status:${status}`,
      actorUserId: sessionUser.id,
      details: reason || null,
      snapshot: appointment,
    })
    return appointment
  })
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newDate: string,
  newTime: string
) {
  const sessionUser = await requireSalonRole(panelRoles)
  if (!appointmentId || !isValidDate(newDate) || !/^\d{2}:\d{2}$/.test(newTime) ||
      Number(newTime.slice(0, 2)) > 23 || Number(newTime.slice(3)) > 59) {
    throw new Error('La nueva fecha o el horario del turno no son válidos.')
  }
  const startDateTime = toWallClockDate(newDate, newTime)
  if (startDateTime <= getNowInSalonWallClock()) throw new Error('No es posible reprogramar a un horario pasado.')

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1)
    if (!existing) throw new Error('Turno no encontrado.')
    if (existing.status === 'cancelled' || existing.status === 'no_show') {
      throw new Error('No se puede reprogramar un turno cancelado o ausente.')
    }

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${existing.professionalId}), hashtext('appointments'))`)
    const duration = existing.totalDurationMinutes
    const endDateTime = new Date(startDateTime.getTime() + duration * 60_000)
    const dayStart = toWallClockDate(newDate, '00:00')
    const dayOfWeek = dayStart.getUTCDay()
    const [schedule] = await tx.select().from(professionalSchedules).where(and(
      eq(professionalSchedules.professionalId, existing.professionalId),
      eq(professionalSchedules.dayOfWeek, dayOfWeek),
      eq(professionalSchedules.isActive, true),
    )).limit(1)
    if (!schedule) throw new Error('La profesional no trabaja en la fecha seleccionada.')

    const absences = await tx.select().from(professionalAbsences).where(and(
      eq(professionalAbsences.professionalId, existing.professionalId),
      lte(professionalAbsences.startDate, newDate),
      gte(professionalAbsences.endDate, newDate),
    ))
    const blocks = await tx.select().from(scheduleBlocks).where(and(
      lt(scheduleBlocks.startDateTime, new Date(dayStart.getTime() + 24 * 60 * 60_000)),
      gt(scheduleBlocks.endDateTime, dayStart),
      or(eq(scheduleBlocks.professionalId, existing.professionalId), isNull(scheduleBlocks.professionalId)),
    ))
    const booked = await tx.select().from(appointments).where(and(
      eq(appointments.professionalId, existing.professionalId),
      inArray(appointments.status, activeAppointmentStatuses),
      lt(appointments.startDateTime, endDateTime),
      gt(appointments.endDateTime, startDateTime),
    ))
    const slots = calculateAvailableSlots({
      dateStr: newDate,
      schedule,
      absences: absences.map(({ startDate, endDate }) => ({ startDate, endDate })),
      blocks: blocks.map((block) => ({
        startMinutes: toDayMinutes(block.startDateTime, dayStart),
        endMinutes: toDayMinutes(block.endDateTime, dayStart),
      })),
      existingAppointments: booked.filter(({ id }) => id !== appointmentId).map((appointment) => ({
        startMinutes: toDayMinutes(appointment.startDateTime, dayStart),
        endMinutes: toDayMinutes(appointment.endDateTime, dayStart),
        status: appointment.status,
      })),
      totalDurationMinutes: duration,
    })
    if (!slots.includes(newTime)) throw new Error('El nuevo horario no está disponible según la agenda.')

    const [result] = await tx.update(appointments)
      .set({ startDateTime, endDateTime, updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId))
      .returning()
    await tx.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: 'rescheduled',
      actorUserId: sessionUser.id,
      details: `${newDate} ${newTime}`,
      snapshot: result,
    })
    return result
  })

  return {
    ...updated,
    date: newDate,
    time: newTime,
    startMinutes: parseTimeToMinutes(newTime),
    endMinutes: parseTimeToMinutes(newTime) + updated.totalDurationMinutes,
    totalPrice: Number(updated.totalPrice),
    requiredDeposit: Number(updated.requiredDeposit),
  }
}

export async function deleteAppointmentAction(appointmentId: string) {
  const sessionUser = await requireSalonRole(panelRoles)
  if (!appointmentId) throw new Error('ID de turno no provisto.')

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)
      .for('update')
    if (!existing) throw new Error('Turno no encontrado.')

    await tx.select({ id: clients.id }).from(clients)
      .where(eq(clients.id, existing.clientId))
      .limit(1)
      .for('update')

    const [updated] = await tx.update(appointments)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId))
      .returning()
    if (!updated) throw new Error('Turno no encontrado.')

    if (existing.status === 'completed') {
      const [completedVisits] = await tx.select({
        count: sql<number>`count(*)::int`,
      }).from(appointments).where(and(
        eq(appointments.clientId, existing.clientId),
        eq(appointments.status, 'completed'),
      ))
      await tx.update(clients)
        .set({ visits: completedVisits.count, updatedAt: new Date() })
        .where(eq(clients.id, existing.clientId))
    }

    await tx.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: 'cancelled',
      actorUserId: sessionUser.id,
      snapshot: updated,
    })
    return updated
  })
}

export async function registerAppointmentPaymentAction(input: {
  appointmentId: string
  amount: number
  method: 'cash' | 'transfer' | 'card' | 'other'
  type: 'deposit' | 'partial' | 'full' | 'refund'
  notes?: string
}) {
  const sessionUser = await requireSalonRole(panelRoles)
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El importe debe ser mayor a 0.')
  if (!input.appointmentId || !['cash', 'transfer', 'card', 'other'].includes(input.method) ||
      !['deposit', 'partial', 'full', 'refund'].includes(input.type)) {
    throw new Error('Los datos del pago no son válidos.')
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from appointment where id = ${input.appointmentId} for update`)
    const [targetAppointment] = await tx.select().from(appointments)
      .where(eq(appointments.id, input.appointmentId)).limit(1)
    if (!targetAppointment) throw new Error('Turno no encontrado.')
    const existingPayments = await tx.select().from(payments)
      .where(eq(payments.appointmentId, input.appointmentId))
    const totalPaidBefore = existingPayments.reduce((total, payment) =>
      total + (payment.type === 'refund' ? -Number(payment.amount) : Number(payment.amount)), 0)
    if (input.type === 'refund' && input.amount > totalPaidBefore) {
      throw new Error('La devolución no puede superar el importe efectivamente abonado.')
    }

    const [payment] = await tx.insert(payments)
      .values({
      id: crypto.randomUUID(),
      appointmentId: input.appointmentId,
      amount: input.amount.toFixed(2),
      method: input.method,
      type: input.type,
      status: 'completed',
      notes: input.notes?.trim() || null,
    })
    .returning()

    const allPayments = [...existingPayments, payment]
    const totalPaid = totalPaidBefore + (input.type === 'refund' ? -input.amount : input.amount)
    const totalPrice = Number(targetAppointment.totalPrice)
    const paymentStatus: 'pending' | 'deposit_paid' | 'partially_paid' | 'paid' | 'refunded' =
      totalPaid <= 0 && allPayments.some((item) => item.type === 'refund')
        ? 'refunded'
        : totalPaid >= totalPrice && totalPrice > 0
          ? 'paid'
          : totalPaid > 0 && allPayments.some((item) => item.type === 'deposit')
            ? 'deposit_paid'
            : totalPaid > 0 ? 'partially_paid' : 'pending'

    await tx.update(appointments)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(eq(appointments.id, input.appointmentId))
    return { payment, paymentStatus }
  })

  return {
    payment: {
      ...result.payment,
      amount: Number(result.payment.amount),
      clientName: '',
      createdAt: result.payment.createdAt.toISOString(),
    },
    balance: { paymentStatus: result.paymentStatus },
  }
}

export async function recordMaterialConsumptionAction(input: {
  materialId: string
  type: 'in' | 'out' | 'adjustment' | 'waste'
  quantity: number
  reason: string
  appointmentId?: string
}) {
  await requireSalonRole(adminRoles)
  const result = await registerStockMovementAction(input)
  if (!('material' in result) || !('movement' in result)) {
    throw new Error('error' in result ? result.error : 'No se pudo registrar el movimiento de stock.')
  }
  return { material: result.material, movement: result.movement }
}
