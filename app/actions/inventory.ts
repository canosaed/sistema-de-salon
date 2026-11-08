'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { inventoryMovements, materials } from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'
import { revalidatePath } from 'next/cache'

export interface MaterialInput { name: string; category: string; unit: string; currentStock: number; minimumStock: number; estimatedCostUnit?: number }
export interface StockMovementInput { materialId: string; type: 'in' | 'out' | 'adjustment' | 'waste'; quantity: number; reason: string; appointmentId?: string }

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
}

export async function getInventoryMaterialsAction() {
  try {
    await requireUser()
    const [materialRows, movementRows] = await Promise.all([
      db.select().from(materials).where(eq(materials.isActive, true)),
      db.select().from(inventoryMovements),
    ])
    return { success: true, materials: materialRows.length ? materialRows : salonRepo.getMaterials(), movements: movementRows.length ? movementRows : salonRepo.getInventoryMovements() }
  } catch (error: any) { return { success: false, error: error.message || 'Error al obtener inventario' } }
}

export async function createMaterialAction(input: MaterialInput) {
  try {
    await requireUser()
    if (!input.name || !input.category || !input.unit) return { success: false, error: 'Nombre, categoría y unidad de medida son obligatorios' }
    if (input.currentStock < 0 || input.minimumStock < 0) return { success: false, error: 'Los niveles de stock no pueden ser negativos' }
    const [material] = await db.insert(materials).values({ id: crypto.randomUUID(), name: input.name.trim(), category: input.category.trim(), unit: input.unit.trim(), currentStock: String(input.currentStock), minStock: String(input.minimumStock), isActive: true }).returning()
    revalidatePath('/')
    return { success: true, material }
  } catch (error: any) { return { success: false, error: error.message || 'Error al crear material' } }
}

export async function updateMaterialAction(id: string, input: Partial<MaterialInput>) {
  try {
    await requireUser()
    const [material] = await db.update(materials).set({ ...(input.name !== undefined && { name: input.name.trim() }), ...(input.category !== undefined && { category: input.category.trim() }), ...(input.unit !== undefined && { unit: input.unit.trim() }), ...(input.currentStock !== undefined && { currentStock: String(input.currentStock) }), ...(input.minimumStock !== undefined && { minStock: String(input.minimumStock) }), updatedAt: new Date() }).where(eq(materials.id, id)).returning()
    revalidatePath('/')
    return { success: true, material }
  } catch (error: any) { return { success: false, error: error.message || 'Error al actualizar material' } }
}

export async function deleteMaterialAction(id: string) {
  try { await requireUser(); const [material] = await db.update(materials).set({ isActive: false, updatedAt: new Date() }).where(eq(materials.id, id)).returning(); revalidatePath('/'); return { success: true, material } }
  catch (error: any) { return { success: false, error: error.message || 'Error al eliminar material' } }
}

export async function registerStockMovementAction(input: StockMovementInput) {
  try {
    await requireUser()
    if (!input.materialId || !input.type || input.quantity === undefined || !input.reason) return { success: false, error: 'Faltan campos obligatorios para el movimiento de inventario' }
    if (input.quantity <= 0 && input.type !== 'adjustment') return { success: false, error: 'La cantidad debe ser mayor a 0' }
    const [material] = await db.select().from(materials).where(and(eq(materials.id, input.materialId), eq(materials.isActive, true))).limit(1)
    if (!material) return { success: false, error: 'Material no encontrado' }
    const current = Number(material.currentStock)
    const delta = input.type === 'in' ? input.quantity : input.type === 'adjustment' ? input.quantity - current : -input.quantity
    if (current + delta < 0) return { success: false, error: 'El stock no puede quedar negativo' }
    const [movement] = await db.insert(inventoryMovements).values({ id: crypto.randomUUID(), materialId: input.materialId, type: input.type, quantity: String(input.quantity), reason: input.reason.trim(), appointmentId: input.appointmentId || null }).returning()
    await db.update(materials).set({ currentStock: String(current + delta), updatedAt: new Date() }).where(eq(materials.id, input.materialId))
    revalidatePath('/')
    return { success: true, movement, currentStock: current + delta }
  } catch (error: any) { return { success: false, error: error.message || 'Error al registrar movimiento de stock' } }
}
