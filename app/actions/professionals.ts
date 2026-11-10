'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { professionalSchedules, professionals } from '@/lib/db/schema'
import { adminRoles, panelRoles, requireSalonRole } from '@/lib/staff-auth'

export interface ProfessionalInput {
  name: string
  phone: string
  email?: string
  specialties?: string
  initials?: string
  serviceIds?: string[]
}

export async function getProfessionals() {
  await requireSalonRole(panelRoles)
  return db.select().from(professionals).where(eq(professionals.isActive, true))
}

export async function createProfessional(input: ProfessionalInput) {
  await requireSalonRole(adminRoles)
  if (!input.name?.trim()) throw new Error('El nombre de la profesional es obligatorio.')
  if (!input.phone?.trim()) throw new Error('El teléfono de contacto es obligatorio.')

  const [professional] = await db.insert(professionals).values({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    specialties: input.specialties || null,
    initials: input.initials?.trim() || input.name.trim().split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    isActive: true,
  }).returning()
  return professional
}

export async function updateProfessional(id: string, input: Partial<ProfessionalInput>) {
  await requireSalonRole(adminRoles)
  if (!id) throw new Error('ID de profesional no provisto.')
  const [professional] = await db.update(professionals).set({
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.phone !== undefined && { phone: input.phone.trim() }),
    ...(input.email !== undefined && { email: input.email.trim() || null }),
    ...(input.specialties !== undefined && { specialties: input.specialties || null }),
    ...(input.initials !== undefined && { initials: input.initials.trim() || null }),
    updatedAt: new Date(),
  }).where(eq(professionals.id, id)).returning()
  return professional
}

export async function deleteProfessional(id: string) {
  await requireSalonRole(adminRoles)
  if (!id) throw new Error('ID de profesional no provisto.')
  const [professional] = await db.update(professionals).set({ isActive: false, updatedAt: new Date() }).where(eq(professionals.id, id)).returning()
  return professional
}

export async function saveScheduleAction(formData: FormData) {
  await requireSalonRole(adminRoles)
  const id = formData.get('id') as string | null
  const professionalId = formData.get('professionalId') as string
  const dayOfWeek = Number(formData.get('dayOfWeek'))
  const startTime = String(formData.get('startTime') || '')
  const endTime = String(formData.get('endTime') || '')
  const breakStartTime = String(formData.get('breakStartTime') || '') || null
  const breakEndTime = String(formData.get('breakEndTime') || '') || null
  const isActive = formData.get('isActive') !== 'false'
  if (!professionalId || !startTime || !endTime || dayOfWeek < 0 || dayOfWeek > 6) throw new Error('Horario inválido.')

  const values = { professionalId, dayOfWeek, startTime, endTime, breakStartTime, breakEndTime, isActive }
  if (id) {
    const [schedule] = await db.update(professionalSchedules).set(values).where(eq(professionalSchedules.id, id)).returning()
    return schedule
  }
  const [schedule] = await db.insert(professionalSchedules).values({ id: crypto.randomUUID(), ...values }).returning()
  return schedule
}

export async function toggleScheduleAction(id: string) {
  await requireSalonRole(adminRoles)
  const [schedule] = await db.select().from(professionalSchedules).where(eq(professionalSchedules.id, id)).limit(1)
  if (!schedule) throw new Error('Horario no encontrado.')
  const [updated] = await db.update(professionalSchedules).set({ isActive: !schedule.isActive }).where(eq(professionalSchedules.id, id)).returning()
  return updated
}

export async function deleteScheduleAction(id: string) {
  await requireSalonRole(adminRoles)
  const [deleted] = await db.delete(professionalSchedules).where(eq(professionalSchedules.id, id)).returning()
  return deleted
}
