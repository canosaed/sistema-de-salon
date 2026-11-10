'use server'

import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inventoryMovements, materials } from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'
import { adminRoles, requireSalonRole } from '@/lib/staff-auth'

export interface MaterialInput { name: string; category: string; unit: string; currentStock: number; minimumStock: number; estimatedCostUnit?: number }
export interface StockMovementInput { materialId: string; type: 'in' | 'out' | 'adjustment' | 'waste'; quantity: number; reason: string; appointmentId?: string }

export async function getInventoryMaterialsAction() {
  try {
    await requireSalonRole(adminRoles)
    const [materialRows, movementRows] = await Promise.all([
      db.select().from(materials).where(eq(materials.isActive, true)),
      db.select().from(inventoryMovements),
    ])
    return { success: true, materials: materialRows, movements: movementRows }
  } catch (error: any) { return { success: false, error: error.message || 'Error al obtener inventario' } }
}

export async function createMaterialAction(input: MaterialInput) {
  try {
    await requireSalonRole(adminRoles)
    if (!input.name || !input.category || !input.unit) return { success: false, error: 'Nombre, categoría y unidad de medida son obligatorios' }
    if (input.currentStock < 0 || input.minimumStock < 0) return { success: false, error: 'Los niveles de stock no pueden ser negativos' }
    const [material] = await db.insert(materials).values({ id: crypto.randomUUID(), name: input.name.trim(), category: input.category.trim(), unit: input.unit.trim(), currentStock: String(input.currentStock), minStock: String(input.minimumStock), isActive: true }).returning()
    revalidatePath('/')
    return { success: true, material }
  } catch (error: any) { return { success: false, error: error.message || 'Error al crear material' } }
}

export async function updateMaterialAction(id: string, input: Partial<MaterialInput>) {
  try {
    await requireSalonRole(adminRoles)
    const [material] = await db.update(materials).set({ ...(input.name !== undefined && { name: input.name.trim() }), ...(input.category !== undefined && { category: input.category.trim() }), ...(input.unit !== undefined && { unit: input.unit.trim() }), ...(input.currentStock !== undefined && { currentStock: String(input.currentStock) }), ...(input.minimumStock !== undefined && { minStock: String(input.minimumStock) }), updatedAt: new Date() }).where(eq(materials.id, id)).returning()
    revalidatePath('/')
    return { success: true, material }
  } catch (error: any) { return { success: false, error: error.message || 'Error al actualizar material' } }
}

export async function deleteMaterialAction(id: string) {
  try { await requireSalonRole(adminRoles); const [material] = await db.update(materials).set({ isActive: false, updatedAt: new Date() }).where(eq(materials.id, id)).returning(); revalidatePath('/'); return { success: true, material } }
  catch (error: any) { return { success: false, error: error.message || 'Error al eliminar material' } }
}

export async function registerStockMovementAction(input: StockMovementInput) {
  try {
    await requireSalonRole(adminRoles)
    if (!input.materialId || !input.type || input.quantity === undefined || !input.reason?.trim()) return { success: false, error: 'Faltan campos obligatorios para el movimiento de inventario' }
    if (!Number.isFinite(input.quantity) || input.quantity < 0 || (input.quantity === 0 && input.type !== 'adjustment')) return { success: false, error: 'La cantidad debe ser válida y no negativa' }
    if (!['in', 'out', 'adjustment', 'waste'].includes(input.type)) return { success: false, error: 'Tipo de movimiento inválido' }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from material where id = ${input.materialId} for update`)
      const [material] = await tx.select().from(materials).where(and(eq(materials.id, input.materialId), eq(materials.isActive, true))).limit(1)
      if (!material) throw new Error('Material no encontrado')
      const current = Number(material.currentStock)
      const delta = input.type === 'in' ? input.quantity : input.type === 'adjustment' ? input.quantity - current : -input.quantity
      if (current + delta < 0) throw new Error('El stock no puede quedar negativo')
      const [movement] = await tx.insert(inventoryMovements).values({
        id: crypto.randomUUID(),
        materialId: input.materialId,
        type: input.type,
        quantity: String(input.quantity),
        reason: input.reason.trim(),
        appointmentId: input.appointmentId || null,
      }).returning()
      const [updatedMaterial] = await tx.update(materials)
        .set({ currentStock: String(current + delta), updatedAt: new Date() })
        .where(eq(materials.id, input.materialId))
        .returning()
      return { movement, material: updatedMaterial, currentStock: current + delta }
    })
    revalidatePath('/')
    return { success: true, ...result }
  } catch (error: any) { return { success: false, error: error.message || 'Error al registrar movimiento de stock' } }
}
