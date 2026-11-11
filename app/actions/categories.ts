'use server'

import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { serviceCategories, services } from '@/lib/db/schema'
import { adminRoles, requireSalonRole } from '@/lib/staff-auth'

const toSlug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export async function getCategoriesAction() {
  await requireSalonRole(adminRoles)
  return db.select().from(serviceCategories).orderBy(serviceCategories.order)
}

export async function createCategoryAction(input: { name: string; description?: string; order?: number }) {
  await requireSalonRole(adminRoles)
  const name = input.name?.trim()
  if (!name) throw new Error('El nombre de la categoría es obligatorio.')
  const slug = toSlug(name)
  if (!slug) throw new Error('El nombre debe incluir letras o números.')
  const [existing] = await db.select({ id: serviceCategories.id }).from(serviceCategories).where(eq(serviceCategories.slug, slug)).limit(1)
  if (existing) throw new Error('Ya existe una categoría con ese nombre.')
  const [category] = await db.insert(serviceCategories).values({ id: crypto.randomUUID(), name, slug, description: input.description?.trim() || null, order: input.order ?? 0 }).returning()
  return category
}

export async function updateCategoryAction(id: string, input: { name?: string; description?: string; order?: number }) {
  await requireSalonRole(adminRoles)
  const name = input.name?.trim()
  const slug = name !== undefined ? toSlug(name) : undefined
  if (name !== undefined && !name) throw new Error('El nombre de la categoría es obligatorio.')
  if (slug !== undefined && !slug) throw new Error('El nombre debe incluir letras o números.')
  if (slug) {
    const [existing] = await db.select({ id: serviceCategories.id }).from(serviceCategories)
      .where(and(eq(serviceCategories.slug, slug), ne(serviceCategories.id, id))).limit(1)
    if (existing) throw new Error('Ya existe una categoría con ese nombre.')
  }
  const [category] = await db.update(serviceCategories).set({ ...(name !== undefined && { name, slug }), ...(input.description !== undefined && { description: input.description.trim() || null }), ...(input.order !== undefined && { order: input.order }) }).where(eq(serviceCategories.id, id)).returning()
  if (!category) throw new Error('Categoría no encontrada.')
  return category
}

export async function deleteCategoryAction(id: string) {
  await requireSalonRole(adminRoles)
  const [assignedService] = await db.select({ id: services.id }).from(services).where(eq(services.categoryId, id)).limit(1)
  if (assignedService) throw new Error('No se puede eliminar la categoría porque tiene servicios asociados. Reasigná esos servicios primero.')
  const [category] = await db.delete(serviceCategories).where(eq(serviceCategories.id, id)).returning()
  if (!category) throw new Error('Categoría no encontrada.')
  return category
}
