'use server'

import { salonRepo } from '@/lib/db/salon-repository'

export interface ServiceInput {
  categoryId: string
  name: string
  description?: string
  price: number
  durationMinutes: number
  prepMinutes?: number
  cleanupMinutes?: number
  depositType?: 'fixed' | 'percentage'
  depositValue?: number
  allowPublicBooking?: boolean
}

/**
 * Consulta listado activo de servicios
 */
export async function getServices() {
  return salonRepo.getServices()
}

/**
 * Alta de un nuevo servicio
 */
export async function createService(input: ServiceInput) {
  if (!input.name || !input.name.trim()) throw new Error('El nombre del servicio es obligatorio.')
  if (!input.categoryId) throw new Error('Debe asignar una categoría al servicio.')
  if (input.price === undefined || input.price < 0) throw new Error('El precio debe ser un valor válido.')
  if (!input.durationMinutes || input.durationMinutes <= 0) throw new Error('La duración debe ser mayor a 0 minutos.')

  return salonRepo.createService(input)
}

/**
 * Modificación de un servicio existente
 */
export async function updateService(id: string, input: Partial<ServiceInput>) {
  if (!id) throw new Error('ID de servicio no provisto.')
  return salonRepo.updateService(id, input)
}

/**
 * Baja lógica del servicio (conserva historial)
 */
export async function deleteService(id: string) {
  if (!id) throw new Error('ID de servicio no provisto.')
  return salonRepo.deleteService(id)
}
