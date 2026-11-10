'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { salonSettings } from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'
import { adminRoles, requireSalonRole } from '@/lib/staff-auth'

export interface SalonSettingsInput { salonName?: string; currency?: string; defaultDepositPercentage?: number; minCancelHoursNotice?: number; autoConfirmPublicBookings?: boolean; allowSimultaneousServices?: boolean; cancellationPolicyText?: string; businessHoursStart?: string; businessHoursEnd?: string }

export async function getSalonSettingsAction() {
  try { await requireSalonRole(adminRoles); const [settings] = await db.select().from(salonSettings).limit(1); return { success: true, settings: settings ?? null } }
  catch (error: any) { return { success: false, error: error.message || 'Error al obtener configuraciones' } }
}

export async function updateSalonSettingsAction(input: SalonSettingsInput) {
  try {
    await requireSalonRole(adminRoles)
    const [existing] = await db.select().from(salonSettings).limit(1)
    const values = { salonName: input.salonName?.trim(), currency: input.currency?.trim(), defaultDepositPercentage: input.defaultDepositPercentage !== undefined ? Number(input.defaultDepositPercentage) : undefined, minNoticeHoursForCancellation: input.minCancelHoursNotice !== undefined ? Number(input.minCancelHoursNotice) : undefined, autoConfirmPublicBookings: input.autoConfirmPublicBookings !== undefined ? Boolean(input.autoConfirmPublicBookings) : undefined, updatedAt: new Date() }
    const [settings] = existing ? await db.update(salonSettings).set(values).where(eq(salonSettings.id, existing.id)).returning() : await db.insert(salonSettings).values({ id: crypto.randomUUID(), salonName: input.salonName?.trim() || 'Atelier Beauty Studio', currency: input.currency?.trim() || 'ARS', defaultDepositPercentage: Number(input.defaultDepositPercentage ?? 30), minNoticeHoursForCancellation: Number(input.minCancelHoursNotice ?? 24), autoConfirmPublicBookings: Boolean(input.autoConfirmPublicBookings ?? false) }).returning()
    revalidatePath('/'); revalidatePath('/reservar'); return { success: true, settings }
  } catch (error: any) { return { success: false, error: error.message || 'Error al actualizar configuraciones' } }
}
