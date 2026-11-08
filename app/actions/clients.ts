'use server'

import { salonRepo } from '@/lib/db/salon-repository'

export interface ClientInput {
  name: string
  phone: string
  email?: string
  notes?: string
}

/**
 * Consulta listado de clientes activos
 */
export async function getClients() {
  return salonRepo.getClients()
}

/**
 * Alta de un nuevo cliente
 */
export async function createClient(input: ClientInput) {
  const name = input.name?.trim()
  const phone = input.phone?.trim()
  if (!name || !phone) {
    throw new Error('El nombre y el teléfono son campos obligatorios.')
  }

  return salonRepo.createClient({
    name,
    phone,
    email: input.email?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  })
}

/**
 * Modificación de un cliente existente
 */
export async function updateClient(input: { id: string; name: string; phone: string; email?: string; notes?: string }) {
  if (!input.id) {
    throw new Error('ID de cliente no provisto.')
  }
  const name = input.name?.trim()
  const phone = input.phone?.trim()
  if (!name || !phone) {
    throw new Error('El nombre y el teléfono son campos obligatorios.')
  }

  return salonRepo.updateClient(input.id, {
    name,
    phone,
    email: input.email?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  })
}

/**
 * Baja lógica de cliente
 */
export async function deleteClient(clientId: string) {
  if (!clientId) {
    throw new Error('ID de cliente no provisto.')
  }
  salonRepo.deleteClient(clientId)
  return { success: true }
}
