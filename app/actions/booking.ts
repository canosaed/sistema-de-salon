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
    throw new Error('No es posible agendar turnos en fechas pasadas ni fuera del calendario.')
  }

  if (!data.time || !/^\d{2}:\d{2}$/.test(data.time)) {
    throw new Error('Debe seleccionar un horario válido.')
  }

  // Validación de teléfono (mínimo 6 dígitos)
  const phoneDigits = phone.replace(/\D/g, '')
  if (phoneDigits.length < 6) {
    throw new Error('Por favor ingrese un número de teléfono válido.')
  }

  // Validación de email si fue provisto
  if (data.clientEmail && data.clientEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.clientEmail.trim())) {
      throw new Error('El correo electrónico ingresado no tiene un formato válido.')
    }
  }

  // Verificar anticipación mínima si es para hoy
  const settings = salonRepo.getSettings()
  const minNoticeHours = settings.minNoticeHoursForBooking || 2
  const now = new Date()
  const [hours, minutes] = data.time.split(':').map(Number)
  const bookingDateTime = new Date(`${data.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`)
  const diffHours = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < minNoticeHours && data.date === todayStr) {
    throw new Error(`Los turnos online requieren al menos ${minNoticeHours} horas de anticipación.`)
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
