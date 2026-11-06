'use server'

import { salonRepo } from '@/lib/db/salon-repository'

export async function getPublicBookingCatalog() {
  const categories = salonRepo.getCategories()
  const services = salonRepo.getServices().filter((s) => s.allowPublicBooking)
  const techniques = salonRepo.getTechniques()
  const professionals = salonRepo.getProfessionals()
  const settings = salonRepo.getSettings()

  return {
    categories,
    services,
    techniques,
    professionals,
    settings,
  }
}

export async function checkPublicAvailability(params: {
  serviceId: string
  techniqueId?: string
  professionalId?: string
  dateStr: string // "YYYY-MM-DD"
}) {
  return salonRepo.getAvailableSlots(params)
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
  if (!service) throw new Error('Servicio no encontrado')

  // Validaciones del cliente
  const name = data.clientName.trim()
  const phone = data.clientPhone.trim()
  if (!name || !phone) {
    throw new Error('Por favor complete su nombre y teléfono de contacto.')
  }

  // Prevenir dobles reservas con control transaccional
  const appointment = salonRepo.createAppointment({
    clientName: name,
    clientPhone: phone,
    clientEmail: data.clientEmail,
    serviceIds: [data.serviceId],
    techniqueIds: data.techniqueId ? [data.techniqueId] : [],
    professionalId: data.professionalId,
    date: data.date,
    time: data.time,
    notes: data.notes,
    isPublicBooking: true,
  })

  return {
    success: true,
    appointment,
    message: '¡Tu reserva ha sido registrada con éxito!',
  }
}
