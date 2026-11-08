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
  if (!service) throw new Error('Servicio no encontrado o no habilitado')
  if (!service.allowPublicBooking) throw new Error('El servicio seleccionado no está disponible para reserva online')

  // Validaciones del cliente
  const name = data.clientName?.trim()
  const phone = data.clientPhone?.trim()
  if (!name || !phone) {
    throw new Error('Por favor complete su nombre y teléfono de contacto.')
  }

  // Validación de fecha no pasada
  const todayStr = new Date().toISOString().split('T')[0]
  if (!data.date || data.date < todayStr) {
    throw new Error('No es posible agendar turnos en fechas pasadas.')
  }

  if (!data.time) {
    throw new Error('Debe seleccionar un horario válido.')
  }

  // Prevenir dobles reservas con control transaccional
  const appointment = salonRepo.createAppointment({
    clientName: name,
    clientPhone: phone,
    clientEmail: data.clientEmail?.trim() || undefined,
    serviceIds: [data.serviceId],
    techniqueIds: data.techniqueId ? [data.techniqueId] : [],
    professionalId: data.professionalId,
    date: data.date,
    time: data.time,
    notes: data.notes?.trim() || undefined,
    isPublicBooking: true,
  })

  return {
    success: true,
    appointment,
    message: '¡Tu reserva ha sido registrada con éxito!',
  }
}
