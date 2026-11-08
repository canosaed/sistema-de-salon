'use server'

import { salonRepo } from '@/lib/db/salon-repository'

export interface ProfessionalInput {
  name: string
  phone: string
  email?: string
  specialties?: string
  initials?: string
  serviceIds?: string[]
}

/**
 * Consulta listado activo de profesionales
 */
export async function getProfessionals() {
  return salonRepo.getProfessionals()
}

/**
 * Alta de una nueva profesional
 */
export async function createProfessional(input: ProfessionalInput) {
  if (!input.name || !input.name.trim()) throw new Error('El nombre de la profesional es obligatorio.')
  if (!input.phone || !input.phone.trim()) throw new Error('El teléfono de contacto es obligatorio.')

  return salonRepo.createProfessional(input)
}

/**
 * Modificación de una profesional existente
 */
export async function updateProfessional(id: string, input: Partial<ProfessionalInput>) {
  if (!id) throw new Error('ID de profesional no provisto.')
  return salonRepo.updateProfessional(id, input)
}

/**
 * Baja lógica de profesional (conserva turnos anteriores e historial según regla 4.6)
 */
export async function deleteProfessional(id: string) {
  if (!id) throw new Error('ID de profesional no provisto.')
  return salonRepo.deleteProfessional(id)
}

/**
 * Operaciones ABM para Turnos y Horarios de Profesionales
 */
export async function saveScheduleAction(formData: FormData) {
  const id = formData.get('id') as string | null
  const professionalId = formData.get('professionalId') as string
  const dayOfWeek = parseInt(formData.get('dayOfWeek') as string, 10)
  const startTime = formData.get('startTime') as string
  const endTime = formData.get('endTime') as string
  const breakStartTime = (formData.get('breakStartTime') as string) || null
  const breakEndTime = (formData.get('breakEndTime') as string) || null
  const isActive = formData.get('isActive') !== 'false'

  if (id) {
    return salonRepo.updateSchedule(id, {
      dayOfWeek,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      isActive,
    })
  } else {
    return salonRepo.createSchedule({
      professionalId,
      dayOfWeek,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      isActive,
    })
  }
}

export async function toggleScheduleAction(id: string) {
  return salonRepo.toggleScheduleActive(id)
}

export async function deleteScheduleAction(id: string) {
  return salonRepo.deleteSchedule(id)
}
