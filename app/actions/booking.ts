'use server'

import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointments, clients, professionals as professionalTable, salonSettings, serviceCategories, services as serviceTable, techniques as techniqueTable, user } from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'

async function getSalonOwnerId() {
  const owners = await db.select({ id: user.id }).from(user).orderBy(asc(user.createdAt)).limit(1)
  if (!owners[0]) throw new Error('El salón todavía no tiene una cuenta administradora configurada.')
  return owners[0].id
}

export async function getPublicBookingCatalog() {
  const [categoryRows, serviceRows, techniqueRows, professionalRows, settingRows] = await Promise.all([
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.order)),
    db.select().from(serviceTable).where(eq(serviceTable.allowPublicBooking, true)),
    db.select().from(techniqueTable).where(eq(techniqueTable.isActive, true)),
    db.select().from(professionalTable).where(eq(professionalTable.isActive, true)),
    db.select().from(salonSettings).limit(1),
  ])
  const categories = categoryRows.length ? categoryRows : salonRepo.getCategories()
  const services = serviceRows.length ? serviceRows.map((service) => ({ ...service, categoryId: service.categoryId || categories[0]?.id || '', price: Number(service.price), depositValue: Number(service.depositValue) })) : salonRepo.getServices().filter((s) => s.allowPublicBooking)
  const techniques = techniqueRows.length ? techniqueRows.map((technique) => ({ ...technique, additionalPrice: Number(technique.additionalPrice) })) : salonRepo.getTechniques()
  const professionals = professionalRows.length ? professionalRows.map((professional) => ({ ...professional, specialties: Array.isArray(professional.specialties) ? professional.specialties : professional.specialties ? professional.specialties.split(',').map((item) => item.trim()) : [] })) : salonRepo.getProfessionals()
  const settings = settingRows[0] || salonRepo.getSettings()

  return { categories, services, techniques, professionals, settings }
}

export async function checkPublicAvailability(params: {
  serviceId: string
  techniqueId?: string
  professionalId?: string
  dateStr: string
}) {
  const availability = salonRepo.getAvailableSlots(params)
  const professionalRows = await db.select().from(professionalTable).where(eq(professionalTable.isActive, true))
  const professionals = professionalRows.length
    ? professionalRows.map((professional) => ({ ...professional, specialties: Array.isArray(professional.specialties) ? professional.specialties : professional.specialties ? professional.specialties.split(',').map((item) => item.trim()) : [] }))
    : salonRepo.getProfessionals()
  const selectedProfessional = professionals.find((pro) => pro.id === params.professionalId)
  const booked = await db.select({ startDateTime: appointments.startDateTime, endDateTime: appointments.endDateTime, professionalId: appointments.professionalId })
    .from(appointments)
    .where(sql`${appointments.status} IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')`)
  const bookedIntervals = booked.filter((appointment) => appointment.startDateTime?.toISOString().startsWith(params.dateStr))
  const slots = availability.slots.filter((slot) => {
    const availableProfessionalIds = params.professionalId && params.professionalId !== 'any'
      ? [params.professionalId]
      : slot.availableProfessionalIds
    return availableProfessionalIds.some((professionalId) => {
      const professional = professionals.find((pro) => pro.id === professionalId)
      if (!professional) return false
      const slotStart = new Date(`${params.dateStr}T${slot.time}:00`)
      const slotEnd = new Date(slotStart.getTime() + (availability.totalDurationMinutes || 30) * 60_000)
      const overlaps = bookedIntervals.some((appointment) => appointment.professionalId === professional.id && appointment.startDateTime && appointment.endDateTime && slotStart < appointment.endDateTime && slotEnd > appointment.startDateTime)
      return !overlaps
    })
  })

  return { ...availability, slots }
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
  const [persistedService] = await db.select().from(serviceTable).where(eq(serviceTable.id, data.serviceId)).limit(1)
  const service = persistedService || salonRepo.getServices().find((s) => s.id === data.serviceId)
  if (!service || !service.allowPublicBooking) throw new Error('Servicio no encontrado o no habilitado')

  const name = data.clientName?.trim()
  const phone = data.clientPhone?.trim()
  if (!name || !phone) throw new Error('Por favor complete su nombre y teléfono de contacto.')
  if (!data.date || data.date < new Date().toISOString().split('T')[0]) throw new Error('No es posible agendar turnos en fechas pasadas.')
  if (!data.time || !/^\d{2}:\d{2}$/.test(data.time)) throw new Error('Debe seleccionar un horario válido.')
  if (phone.replace(/\D/g, '').length < 6) throw new Error('Por favor ingrese un número de teléfono válido.')
  if (data.clientEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail.trim())) throw new Error('El correo electrónico ingresado no tiene un formato válido.')

  const [persistedSettings] = await db.select().from(salonSettings).limit(1)
  const settings = persistedSettings || salonRepo.getSettings()
  const minNoticeHours = settings.minNoticeHoursForBooking || 2
  const bookingDateTime = new Date(`${data.date}T${data.time}:00`)
  if (data.date === new Date().toISOString().split('T')[0] && (bookingDateTime.getTime() - Date.now()) / 3600000 < minNoticeHours) {
    throw new Error(`Los turnos online requieren al menos ${minNoticeHours} horas de anticipación.`)
  }

  const persistedProfessionals = await db.select().from(professionalTable).where(eq(professionalTable.isActive, true))
  const professionals = persistedProfessionals.length ? persistedProfessionals.map((professional) => ({ ...professional, specialties: Array.isArray(professional.specialties) ? professional.specialties : professional.specialties ? professional.specialties.split(',').map((item) => item.trim()) : [] })) : salonRepo.getProfessionals()
  const availability = salonRepo.getAvailableSlots({
    serviceId: data.serviceId,
    techniqueId: data.techniqueId,
    professionalId: data.professionalId,
    dateStr: data.date,
  })
  const assignedProfessional = data.professionalId && data.professionalId !== 'any'
    ? professionals.find((professional) => professional.id === data.professionalId)
    : professionals.find((professional) => availability.slots.some((slot) => slot.time === data.time && slot.availableProfessionalIds.includes(professional.id)))
  if (!assignedProfessional) throw new Error('No hay profesionales disponibles para ese horario.')
  if (!availability.slots.some((slot) => slot.time === data.time && slot.availableProfessionalIds.includes(assignedProfessional.id))) {
    throw new Error('Ese horario ya no está disponible. Elegí otro horario.')
  }

  const totalDurationMinutes = availability.totalDurationMinutes || service.durationMinutes
  const totalPrice = Number(availability.totalPrice ?? service.price ?? 0)
  const requiredDeposit = Number(availability.depositAmount ?? (service.depositType === 'fixed'
    ? service.depositValue
    : Math.round((totalPrice * Number(service.depositValue ?? 30)) / 100)))
  const startDateTime = new Date(`${data.date}T${data.time}:00`)
  const endDateTime = new Date(startDateTime.getTime() + totalDurationMinutes * 60_000)
  const conflicting = (await db.select({ id: appointments.id, startDateTime: appointments.startDateTime, endDateTime: appointments.endDateTime })
    .from(appointments)
    .where(and(eq(appointments.professionalId, assignedProfessional.id), sql`${appointments.status} IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')`)))
    .find((existing) => existing.startDateTime && existing.endDateTime && startDateTime < existing.endDateTime && endDateTime > existing.startDateTime)
  if (conflicting) throw new Error('Ese horario acaba de ser reservado. Elegí otro horario.')

  const ownerId = await getSalonOwnerId()
  const existingClient = await db.select({ id: clients.id }).from(clients).where(eq(clients.phone, phone)).limit(1)
  const clientId = existingClient[0]?.id || crypto.randomUUID()
  if (!existingClient[0]) {
    await db.insert(clients).values({ id: clientId, userId: ownerId, name, phone, email: data.clientEmail?.trim() || null, notes: data.notes?.trim() || null, visits: 0 })
  }

  const appointment = {
    id: crypto.randomUUID(),
    clientId,
    professionalId: assignedProfessional.id,
    serviceId: data.serviceId,
    startDateTime,
    endDateTime,
    totalDurationMinutes,
    totalPrice: totalPrice.toFixed(2),
    requiredDeposit: requiredDeposit.toFixed(2),
    status: 'pending_confirmation',
    paymentStatus: 'pending',
    notes: data.notes?.trim() || 'Reserva online',
    isPublicBooking: true,
  }
  await db.insert(appointments).values(appointment)


  return {
    success: true,
    appointment: {
      ...appointment,
      date: data.date,
      time: data.time,
      clientName: name,
      serviceName: service.name,
      professional: assignedProfessional.name,
      totalDurationMinutes,
      totalPrice,
      requiredDeposit,
      status: 'pending_confirmation',
    },
    message: '¡Tu reserva ha sido registrada con éxito!',
  }
}
