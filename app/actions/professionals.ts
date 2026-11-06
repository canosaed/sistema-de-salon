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
