'use server'

import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { professionalSpecialties, specialties } from '@/lib/db/schema'
import { adminRoles, requireSalonRole } from '@/lib/staff-auth'

export async function getSpecialtiesAction() {
  await requireSalonRole(adminRoles)
  return db.select().from(specialties).orderBy(specialties.name)
}

export async function createSpecialtyAction(nameInput: string) {
  await requireSalonRole(adminRoles)
  const name = nameInput.trim()
  if (!name) throw new Error('El nombre de la especialidad es obligatorio.')
  const [existing] = await db.select({ id: specialties.id }).from(specialties)
    .where(sql`lower(${specialties.name}) = lower(${name})`).limit(1)
  if (existing) throw new Error('Ya existe una especialidad con ese nombre.')
  const [specialty] = await db.insert(specialties)
    .values({ id: crypto.randomUUID(), name })
    .returning()
  return specialty
}

export async function updateSpecialtyAction(id: string, nameInput: string) {
  await requireSalonRole(adminRoles)
  if (!id) throw new Error('ID de especialidad no provisto.')
  const name = nameInput.trim()
  if (!name) throw new Error('El nombre de la especialidad es obligatorio.')
  const [existing] = await db.select({ id: specialties.id }).from(specialties)
    .where(and(sql`lower(${specialties.name}) = lower(${name})`, ne(specialties.id, id))).limit(1)
  if (existing) throw new Error('Ya existe una especialidad con ese nombre.')
  const [specialty] = await db.update(specialties).set({ name })
    .where(eq(specialties.id, id)).returning()
  if (!specialty) throw new Error('Especialidad no encontrada.')
  return specialty
}

export async function deleteSpecialtyAction(id: string) {
  await requireSalonRole(adminRoles)
  const [assignment] = await db.select({ id: professionalSpecialties.id })
    .from(professionalSpecialties)
    .where(eq(professionalSpecialties.specialtyId, id))
    .limit(1)
  if (assignment) {
    throw new Error('No se puede eliminar la especialidad porque está asignada a una profesional.')
  }
  const [specialty] = await db.delete(specialties).where(eq(specialties.id, id)).returning()
  if (!specialty) throw new Error('Especialidad no encontrada.')
  return specialty
}
