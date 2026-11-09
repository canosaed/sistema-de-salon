'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { serviceCategories } from '@/lib/db/schema'

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
}

const toSlug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export async function getCategoriesAction() {
  await requireUser()
  return db.select().from(serviceCategories).orderBy(serviceCategories.order)
}

export async function createCategoryAction(input: { name: string; description?: string; order?: number }) {
  await requireUser()
  const name = input.name?.trim()
  if (!name) throw new Error('El nombre de la categoría es obligatorio.')
  const [category] = await db.insert(serviceCategories).values({ id: crypto.randomUUID(), name, slug: toSlug(name), description: input.description?.trim() || null, order: input.order ?? 0 }).returning()
  return category
}

export async function updateCategoryAction(id: string, input: { name?: string; description?: string; order?: number }) {
  await requireUser()
  const [category] = await db.update(serviceCategories).set({ ...(input.name !== undefined && { name: input.name.trim(), slug: toSlug(input.name) }), ...(input.description !== undefined && { description: input.description.trim() || null }), ...(input.order !== undefined && { order: input.order }) }).where(eq(serviceCategories.id, id)).returning()
  if (!category) throw new Error('Categoría no encontrada.')
  return category
}

export async function deleteCategoryAction(id: string) {
  await requireUser()
  const [category] = await db.delete(serviceCategories).where(eq(serviceCategories.id, id)).returning()
  if (!category) throw new Error('Categoría no encontrada.')
  return category
}
