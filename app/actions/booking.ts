'use server'

import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  clients,
  professionalAbsences,
  professionalSchedules,
  professionalServices,
  professionals,
  salonSettings,
  serviceCategories,
  services,
  scheduleBlocks,
  techniques,
  user,
} from '@/lib/db/schema'
import {
  calculateAppointmentTotals,
  calculateAvailableSlots,
  parseTimeToMinutes,
} from '@/lib/business-logic'
import { SALON_TIME_ZONE } from '@/lib/salon-time'

const activeAppointmentStatuses = ['pending_confirmation', 'confirmed', 'waiting', 'in_progress']

type BookingParams = {
  serviceId: string
  techniqueId?: string
  professionalId?: string
  dateStr: string
}

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

async function loadPublicAvailability(params: BookingParams) {
  if (!isValidDate(params.dateStr)) throw new Error('La fecha seleccionada no es válida.')

  const [service] = await db.select().from(services).where(and(
    eq(services.id, params.serviceId),
    eq(services.isActive, true),
    eq(services.allowPublicBooking, true),
  )).limit(1)
  if (!service) throw new Error('Servicio no encontrado o no habilitado para reservas públicas.')

  const technique = params.techniqueId
    ? (await db.select().from(techniques).where(and(
      eq(techniques.id, params.techniqueId),
      eq(techniques.serviceId, service.id),
      eq(techniques.isActive, true),
    )).limit(1))[0]
    : undefined
  if (params.techniqueId && !technique) throw new Error('La técnica seleccionada no está disponible para este servicio.')

  const totals = calculateAppointmentTotals([{
    serviceId: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    prepMinutes: service.prepMinutes,
    cleanupMinutes: service.cleanupMinutes,
    price: Number(service.price),
    additionalMinutes: technique?.additionalMinutes ?? 0,
    additionalPrice: Number(technique?.additionalPrice ?? 0),
  }])

  const professionalLinks = await db.select({ professionalId: professionalServices.professionalId })
    .from(professionalServices)
    .where(eq(professionalServices.serviceId, service.id))
  const professionalIds = professionalLinks.map(({ professionalId }) => professionalId)
  if (!professionalIds.length) {
    return {
      service,
      technique,
      totals,
      depositAmount: service.depositType === 'fixed'
        ? Number(service.depositValue)
        : Math.round((totals.totalPrice * Number(service.depositValue)) / 100),
      eligibleProfessionals: [],
      slots: [],
    }
  }

  const selectedIds = params.professionalId && params.professionalId !== 'any'
    ? professionalIds.filter((id) => id === params.professionalId)
    : professionalIds
  if (!selectedIds.length) throw new Error('La profesional seleccionada no está habilitada para este servicio.')

  const activeProfessionals = await db.select().from(professionals).where(and(
    inArray(professionals.id, selectedIds),
    eq(professionals.isActive, true),
  ))
  const candidateIds = activeProfessionals.map(({ id }) => id)
  if (!candidateIds.length) {
    return {
      service,
      technique,
      totals,
      depositAmount: service.depositType === 'fixed'
        ? Number(service.depositValue)
        : Math.round((totals.totalPrice * Number(service.depositValue)) / 100),
      eligibleProfessionals: [],
      slots: [],
    }
  }

  const [year, month, day] = params.dateStr.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const dayStart = toWallClockDate(params.dateStr, '00:00')
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000)
  const [schedules, absences, blocks, booked] = await Promise.all([
    db.select().from(professionalSchedules).where(and(
      inArray(professionalSchedules.professionalId, candidateIds),
      eq(professionalSchedules.dayOfWeek, dayOfWeek),
      eq(professionalSchedules.isActive, true),
    )),
    db.select().from(professionalAbsences).where(and(
      inArray(professionalAbsences.professionalId, candidateIds),
      lte(professionalAbsences.startDate, params.dateStr),
      gte(professionalAbsences.endDate, params.dateStr),
    )),
    db.select().from(scheduleBlocks).where(and(
      lt(scheduleBlocks.startDateTime, dayEnd),
      gt(scheduleBlocks.endDateTime, dayStart),
      or(
        inArray(scheduleBlocks.professionalId, candidateIds),
        isNull(scheduleBlocks.professionalId),
      ),
    )),
    db.select().from(appointments).where(and(
      inArray(appointments.professionalId, candidateIds),
      inArray(appointments.status, activeAppointmentStatuses),
      lt(appointments.startDateTime, dayEnd),
      gt(appointments.endDateTime, dayStart),
    )),
  ])

  const slotsByTime = new Map<string, string[]>()
  for (const professional of activeProfessionals) {
    const schedule = schedules.find(({ professionalId }) => professionalId === professional.id)
    if (!schedule) continue

    const proBlocks = blocks
      .filter((block) => block.professionalId === null || block.professionalId === professional.id)
      .map((block) => ({
        startMinutes: Math.floor((block.startDateTime.getTime() - dayStart.getTime()) / 60_000),
        endMinutes: Math.floor((block.endDateTime.getTime() - dayStart.getTime()) / 60_000),
      }))
    const proBookings = booked
      .filter(({ professionalId }) => professionalId === professional.id)
      .map((appointment) => ({
        startMinutes: Math.floor((appointment.startDateTime.getTime() - dayStart.getTime()) / 60_000),
        endMinutes: Math.floor((appointment.endDateTime.getTime() - dayStart.getTime()) / 60_000),
        status: appointment.status,
      }))
    const proAbsences = absences
      .filter(({ professionalId }) => professionalId === professional.id)
      .map(({ startDate, endDate }) => ({ startDate, endDate }))

    const availableTimes = calculateAvailableSlots({
      dateStr: params.dateStr,
      schedule,
      existingAppointments: proBookings,
      absences: proAbsences,
      blocks: proBlocks,
      totalDurationMinutes: totals.totalOccupiedDurationMinutes,
    })
    for (const time of availableTimes) {
      const available = slotsByTime.get(time) || []
      available.push(professional.id)
      slotsByTime.set(time, available)
    }
  }

  return {
    service,
    technique,
    totals,
    depositAmount: service.depositType === 'fixed'
      ? Number(service.depositValue)
      : Math.round((totals.totalPrice * Number(service.depositValue)) / 100),
    eligibleProfessionals: activeProfessionals,
    slots: Array.from(slotsByTime.entries())
      .sort(([a], [b]) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
      .map(([time, availableProfessionalIds]) => ({ time, availableProfessionalIds })),
  }
}

export async function getPublicBookingCatalog() {
  const [categories, servicesRows, techniquesRows, professionalsRows, professionalLinks, settingsRows] = await Promise.all([
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.order)),
    db.select().from(services).where(and(eq(services.isActive, true), eq(services.allowPublicBooking, true))),
    db.select().from(techniques).where(eq(techniques.isActive, true)),
    db.select().from(professionals).where(eq(professionals.isActive, true)),
    db.select({ professionalId: professionalServices.professionalId, serviceId: professionalServices.serviceId }).from(professionalServices),
    db.select().from(salonSettings).limit(1),
  ])
  const publicServiceIds = new Set(servicesRows.map(({ id }) => id))
  const bookableProfessionalIds = new Set(
    professionalLinks.filter(({ serviceId }) => publicServiceIds.has(serviceId)).map(({ professionalId }) => professionalId)
  )
  return {
    categories,
    services: servicesRows.map((service) => ({
      ...service,
      price: Number(service.price),
      depositValue: Number(service.depositValue),
    })),
    techniques: techniquesRows.map((technique) => ({
      ...technique,
      additionalPrice: Number(technique.additionalPrice),
    })),
    professionals: professionalsRows.filter(({ id }) => bookableProfessionalIds.has(id)).map((professional) => ({
      ...professional,
      specialties: professional.specialties
        ? professional.specialties.split(',').map((item) => item.trim())
        : [],
    })),
    settings: settingsRows[0] ?? null,
  }
}

export async function checkPublicAvailability(params: BookingParams) {
  const availability = await loadPublicAvailability(params)
  return {
    slots: availability.slots,
    totalDurationMinutes: availability.totals.totalOccupiedDurationMinutes,
    totalPrice: availability.totals.totalPrice,
    depositAmount: availability.depositAmount,
    eligibleProfessionals: availability.eligibleProfessionals,
  }
}

export async function createPublicBooking(data: {
  serviceId: string
  techniqueId?: string
  professionalId?: string
  date: string
  time: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  notes?: string
}) {
  const name = data.clientName?.trim()
  const phone = data.clientPhone?.trim()
  if (!name || !phone) throw new Error('Por favor complete su nombre y teléfono de contacto.')
  if (!/^\d{2}:\d{2}$/.test(data.time) || Number(data.time.slice(0, 2)) > 23 || Number(data.time.slice(3)) > 59) {
    throw new Error('Debe seleccionar un horario válido.')
  }
  if (phone.replace(/\D/g, '').length < 6) throw new Error('Por favor ingrese un número de teléfono válido.')
  const email = data.clientEmail?.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo electrónico ingresado no tiene un formato válido.')
  }

  const nowInSalon = getNowInSalonWallClock()
  const today = `${nowInSalon.getUTCFullYear()}-${String(nowInSalon.getUTCMonth() + 1).padStart(2, '0')}-${String(nowInSalon.getUTCDate()).padStart(2, '0')}`
  if (!isValidDate(data.date) || data.date < today) throw new Error('No es posible agendar turnos en fechas pasadas.')
  const startDateTime = toWallClockDate(data.date, data.time)
  if (startDateTime.getTime() <= nowInSalon.getTime()) throw new Error('No es posible agendar turnos en fechas u horarios pasados.')

  const availability = await loadPublicAvailability({ ...data, dateStr: data.date })
  const slot = availability.slots.find(({ time }) => time === data.time)
  if (!slot) throw new Error('Ese horario ya no está disponible. Elegí otro horario.')

  const [settings] = await db.select().from(salonSettings).limit(1)
  const minNoticeHours = settings?.minNoticeHoursForBooking ?? 2
  if ((startDateTime.getTime() - nowInSalon.getTime()) / 3_600_000 < minNoticeHours) {
    throw new Error(`Los turnos online requieren al menos ${minNoticeHours} horas de anticipación.`)
  }

  const owner = (await db.select({ id: user.id }).from(user).orderBy(asc(user.createdAt)).limit(1))[0]
  if (!owner) throw new Error('El salón todavía no tiene una cuenta administradora configurada.')

  const eligibleProfessionalIds = data.professionalId && data.professionalId !== 'any'
    ? slot.availableProfessionalIds.filter((id) => id === data.professionalId)
    : slot.availableProfessionalIds
  if (!eligibleProfessionalIds.length) throw new Error('No hay profesionales disponibles para ese horario.')

  const appointmentId = crypto.randomUUID()
  const endDateTime = new Date(startDateTime.getTime() + availability.totals.totalOccupiedDurationMinutes * 60_000)
  let assignedProfessionalId: string | null = null

  await db.transaction(async (tx) => {
    for (const professionalId of eligibleProfessionalIds) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${professionalId}), hashtext('appointments'))`)
      const conflicts = await tx.select({ id: appointments.id })
        .from(appointments)
        .where(and(
          eq(appointments.professionalId, professionalId),
          inArray(appointments.status, activeAppointmentStatuses),
          lt(appointments.startDateTime, endDateTime),
          gt(appointments.endDateTime, startDateTime),
        ))
        .limit(1)
      if (!conflicts.length) {
        assignedProfessionalId = professionalId
        break
      }
    }
    if (!assignedProfessionalId) throw new Error('Ese horario acaba de ser reservado. Elegí otro horario.')

    const [existingClient] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.phone, phone)).limit(1)
    const clientId = existingClient?.id ?? crypto.randomUUID()
    if (!existingClient) {
      await tx.insert(clients).values({
        id: clientId,
        userId: owner.id,
        name,
        phone,
        email: email || null,
        notes: data.notes?.trim() || null,
        visits: 0,
      })
    }

    await tx.insert(appointments).values({
      id: appointmentId,
      clientId,
      professionalId: assignedProfessionalId,
      startDateTime,
      endDateTime,
      totalDurationMinutes: availability.totals.totalOccupiedDurationMinutes,
      totalPrice: availability.totals.totalPrice.toFixed(2),
      requiredDeposit: availability.depositAmount.toFixed(2),
      status: settings?.autoConfirmPublicBookings ? 'confirmed' : 'pending_confirmation',
      paymentStatus: 'pending',
      notes: data.notes?.trim() || 'Reserva online',
      isPublicBooking: true,
    })
    await tx.insert(appointmentServices).values({
      id: crypto.randomUUID(),
      appointmentId,
      serviceId: availability.service.id,
      techniqueId: availability.technique?.id ?? null,
      historicServiceName: availability.service.name,
      historicTechniqueName: availability.technique?.name ?? null,
      historicPrice: (Number(availability.service.price) + Number(availability.technique?.additionalPrice ?? 0)).toFixed(2),
      historicDurationMinutes: availability.service.durationMinutes + (availability.technique?.additionalMinutes ?? 0),
      historicPrepMinutes: availability.service.prepMinutes,
      historicCleanupMinutes: availability.service.cleanupMinutes,
      sequenceOrder: 1,
    })
    await tx.insert(appointmentHistory).values({
      id: crypto.randomUUID(),
      appointmentId,
      action: 'created_public',
      details: 'Reserva creada desde el portal público',
    })
  })

  const assignedProfessional = availability.eligibleProfessionals.find(({ id }) => id === assignedProfessionalId)
  if (!assignedProfessional) throw new Error('No se pudo asignar una profesional a la reserva.')

  return {
    success: true,
    appointment: {
      id: appointmentId,
      date: data.date,
      time: data.time,
      clientName: name,
      serviceName: availability.service.name,
      professional: assignedProfessional.name,
      totalDurationMinutes: availability.totals.totalOccupiedDurationMinutes,
      totalPrice: availability.totals.totalPrice,
      requiredDeposit: availability.depositAmount,
      status: settings?.autoConfirmPublicBookings ? 'confirmed' : 'pending_confirmation',
    },
    message: '¡Tu reserva ha sido registrada con éxito!',
  }
}
