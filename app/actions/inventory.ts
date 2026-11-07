'use server'

import { salonRepo } from '@/lib/db/salon-repository'
import { revalidatePath } from 'next/cache'

export interface MaterialInput {
  name: string
  category: string
  unit: string
  currentStock: number
  minimumStock: number
  estimatedCostUnit?: number
}

export interface StockMovementInput {
  materialId: string
  type: 'in' | 'out' | 'adjustment' | 'waste'
  quantity: number
  reason: string
  appointmentId?: string
}

export async function getInventoryMaterialsAction() {
  try {
    const materials = salonRepo.getMaterials()
    const movements = salonRepo.getInventoryMovements()
    return { success: true, materials, movements }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al obtener inventario' }
  }
}

export async function createMaterialAction(input: MaterialInput) {
  try {
    if (!input.name || !input.category || !input.unit) {
      return { success: false, error: 'Nombre, categoría y unidad de medida son obligatorios' }
    }
    if (input.currentStock < 0 || input.minimumStock < 0) {
      return { success: false, error: 'Los niveles de stock no pueden ser negativos' }
    }

    const material = salonRepo.createMaterial({
      name: input.name,
      category: input.category,
      unit: input.unit,
      currentStock: Number(input.currentStock),
      minimumStock: Number(input.minimumStock),
      estimatedCostUnit: input.estimatedCostUnit ? Number(input.estimatedCostUnit) : undefined,
    })

    revalidatePath('/')
    return { success: true, material }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al crear material' }
  }
}

export async function updateMaterialAction(id: string, input: Partial<MaterialInput>) {
  try {
    const updated = salonRepo.updateMaterial(id, {
      name: input.name,
      category: input.category,
      unit: input.unit,
      currentStock: input.currentStock !== undefined ? Number(input.currentStock) : undefined,
      minimumStock: input.minimumStock !== undefined ? Number(input.minimumStock) : undefined,
      estimatedCostUnit: input.estimatedCostUnit !== undefined ? Number(input.estimatedCostUnit) : undefined,
    })

    revalidatePath('/')
    return { success: true, material: updated }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al actualizar material' }
  }
}

export async function deleteMaterialAction(id: string) {
  try {
    const result = salonRepo.deleteMaterial(id)
    revalidatePath('/')
    return { success: true, result }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al eliminar material' }
  }
}

export async function registerStockMovementAction(input: StockMovementInput) {
  try {
    if (!input.materialId || !input.type || input.quantity === undefined || !input.reason) {
      return { success: false, error: 'Faltan campos obligatorios para el movimiento de inventario' }
    }
    if (input.quantity <= 0 && input.type !== 'adjustment') {
      return { success: false, error: 'La cantidad debe ser mayor a 0' }
    }

    const result = salonRepo.registerMaterialMovement({
      materialId: input.materialId,
      type: input.type,
      quantity: Number(input.quantity),
      reason: input.reason.trim(),
      appointmentId: input.appointmentId,
    })

    revalidatePath('/')
    return { success: true, ...result }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al registrar movimiento de stock' }
  }
}
