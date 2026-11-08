'use server'

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { publicAppointments } from '@/lib/db/public-appointments'
import { publicClients } from '@/lib/db/public-client'
import { salonRepo } from '@/lib/db/salon-repository'

async function getSalonOwnerId() {
  const owners = await db.select({ id: user.id }).from(user).orderBy(asc(user.createdAt)).limit(1)
  if (!owners[0]) throw new Error('El salón todavía no tiene una cuenta administradora configurada.')
  return owners[0].id
}

export async function getPublicBookingCatalog() {
  const categories = salonRepo.getCategories()
  const services = salonRepo.getServices().filter((s) => s.allowPublicBooking)
  const techniques = salonRepo.getTechniques()
  const professionals = salonRepo.getProfessionals()
  const settings = salonRepo.getSettings()

  return { categories, services, techniques, professionals, settings }
}

export async function checkPublicAvailability(params: {
  serviceId: string
  techniqueId?: string
  professionalId?: string
  dateStr: string
}) {
  const availability = salonRepo.getAvailableSlots(params)
  const professionals = salonRepo.getProfessionals()
  const selectedProfessional = professionals.find((pro) => pro.id === params.professionalId)
  const booked = await db.select({ time: publicAppointments.appointmentTime, professional: publicAppointments.professional })
    .from(publicAppointments)
    .where(and(eq(publicAppointments.appointmentDate, params.dateStr), eq(publicAppointments.status, 'Pendiente')))

  const bookedTimes = new Set(booked.map((appointment) => `${appointment.time}|${appointment.professional}`))
  const slots = availability.slots.filter((slot) => {
    const availableProfessionalIds = params.professionalId && params.professionalId !== 'any'
      ? [params.professionalId]
      : slot.availableProfessionalIds
    return availableProfessionalIds.some((professionalId) => {
      const professional = professionals.find((pro) => pro.id === professionalId)
      return professional && !bookedTimes.has(`${slot.time}|${professional.name}`)
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
  const service = salonRepo.getServices().find((s) => s.id === data.serviceId)
  if (!service || !service.allowPublicBooking) throw new Error('Servicio no encontrado o no habilitado')

  const name = data.clientName?.trim()
  const phone = data.clientPhone?.trim()
  if (!name || !phone) throw new Error('Por favor complete su nombre y teléfono de contacto.')
  if (!data.date || data.date < new Date().toISOString().split('T')[0]) throw new Error('No es posible agendar turnos en fechas pasadas.')
  if (!data.time || !/^\d{2}:\d{2}$/.test(data.time)) throw new Error('Debe seleccionar un horario válido.')
  if (phone.replace(/\D/g, '').length < 6) throw new Error('Por favor ingrese un número de teléfono válido.')
  if (data.clientEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail.trim())) throw new Error('El correo electrónico ingresado no tiene un formato válido.')

  const settings = salonRepo.getSettings()
  const minNoticeHours = settings.minNoticeHoursForBooking || 2
  const bookingDateTime = new Date(`${data.date}T${data.time}:00`)
  if (data.date === new Date().toISOString().split('T')[0] && (bookingDateTime.getTime() - Date.now()) / 3600000 < minNoticeHours) {
    throw new Error(`Los turnos online requieren al menos ${minNoticeHours} horas de anticipación.`)
  }

  const professionals = salonRepo.getProfessionals()
  const assignedProfessional = data.professionalId && data.professionalId !== 'any'
    ? professionals.find((professional) => professional.id === data.professionalId)
    : professionals.find((professional) => salonRepo.getAvailableSlots({ serviceId: data.serviceId, techniqueId: data.techniqueId, professionalId: professional.id, dateStr: data.date }).slots.some((slot) => slot.time === data.time))
  if (!assignedProfessional) throw new Error('No hay profesionales disponibles para ese horario.')

  const conflicting = await db.select({ id: publicAppointments.id }).from(publicAppointments).where(and(
    eq(publicAppointments.appointmentDate, data.date),
    eq(publicAppointments.appointmentTime, data.time),
    eq(publicAppointments.professional, assignedProfessional.name),
    eq(publicAppointments.status, 'Pendiente'),
  )).limit(1)
  if (conflicting.length) throw new Error('Ese horario acaba de ser reservado. Elegí otro horario.')

  const ownerId = await getSalonOwnerId()
  const existingClient = await db.select({ id: publicClients.id }).from(publicClients).where(eq(publicClients.phone, phone)).limit(1)
  const clientId = existingClient[0]?.id || crypto.randomUUID()
  if (!existingClient[0]) {
    await db.insert(publicClients).values({ id: clientId, userId: ownerId, name, phone, email: data.clientEmail?.trim() || null, notes: data.notes?.trim() || null, visits: 0 })
  }

  const appointment = {
    id: crypto.randomUUID(),
    userId: ownerId,
    client: name,
    service: service.name,
    appointmentDate: data.date,
    appointmentTime: data.time,
    professional: assignedProfessional.name,
    status: 'Pendiente',
  }
  await db.insert(publicAppointments).values(appointment)

  return { success: true, appointment, message: '¡Tu reserva ha sido registrada con éxito!' }
}
