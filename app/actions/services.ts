'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { services } from '@/lib/db/schema'
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

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

export async function getServices() {
  const rows = await db.select().from(services).where(eq(services.isActive, true))
  return rows.length ? rows : salonRepo.getServices()
}

export async function createService(input: ServiceInput) {
  await requireUser()
  if (!input.name?.trim()) throw new Error('El nombre del servicio es obligatorio.')
  if (!input.categoryId) throw new Error('Debe asignar una categoría al servicio.')
  if (input.price === undefined || input.price < 0) throw new Error('El precio debe ser un valor válido.')
  if (!input.durationMinutes || input.durationMinutes <= 0) throw new Error('La duración debe ser mayor a 0 minutos.')

  const [service] = await db.insert(services).values({
    id: crypto.randomUUID(),
    categoryId: input.categoryId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: String(input.price),
    durationMinutes: input.durationMinutes,
    prepMinutes: input.prepMinutes || 0,
    cleanupMinutes: input.cleanupMinutes || 0,
    depositType: input.depositType || 'fixed',
    depositValue: String(input.depositValue || 0),
    allowPublicBooking: input.allowPublicBooking ?? true,
    isActive: true,
  }).returning()
  return service
}

export async function updateService(id: string, input: Partial<ServiceInput>) {
  await requireUser()
  if (!id) throw new Error('ID de servicio no provisto.')
  const [service] = await db.update(services).set({
    ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.description !== undefined && { description: input.description.trim() || null }),
    ...(input.price !== undefined && { price: String(input.price) }),
    ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
    ...(input.prepMinutes !== undefined && { prepMinutes: input.prepMinutes }),
    ...(input.cleanupMinutes !== undefined && { cleanupMinutes: input.cleanupMinutes }),
    ...(input.depositType !== undefined && { depositType: input.depositType }),
    ...(input.depositValue !== undefined && { depositValue: String(input.depositValue) }),
    ...(input.allowPublicBooking !== undefined && { allowPublicBooking: input.allowPublicBooking }),
    updatedAt: new Date(),
  }).where(eq(services.id, id)).returning()
  return service
}

export async function deleteService(id: string) {
  await requireUser()
  if (!id) throw new Error('ID de servicio no provisto.')
  const [service] = await db.update(services).set({ isActive: false, updatedAt: new Date() }).where(eq(services.id, id)).returning()
  return service
}
