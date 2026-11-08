'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { salonSettings } from '@/lib/db/schema'
import { salonRepo } from '@/lib/db/salon-repository'
import { revalidatePath } from 'next/cache'

export interface SalonSettingsInput { salonName?: string; currency?: string; defaultDepositPercentage?: number; minCancelHoursNotice?: number; autoConfirmPublicBookings?: boolean; allowSimultaneousServices?: boolean; cancellationPolicyText?: string; businessHoursStart?: string; businessHoursEnd?: string }

async function requireUser() { const session = await auth.api.getSession({ headers: await headers() }); if (!session?.user) throw new Error('Unauthorized') }

export async function getSalonSettingsAction() {
  try { await requireUser(); const [settings] = await db.select().from(salonSettings).limit(1); return { success: true, settings: settings || salonRepo.getSettings() } }
  catch (error: any) { return { success: false, error: error.message || 'Error al obtener configuraciones' } }
}

export async function updateSalonSettingsAction(input: SalonSettingsInput) {
  try {
    await requireUser()
    const [existing] = await db.select().from(salonSettings).limit(1)
    const values = { salonName: input.salonName?.trim(), currency: input.currency?.trim(), defaultDepositPercentage: input.defaultDepositPercentage !== undefined ? Number(input.defaultDepositPercentage) : undefined, minNoticeHoursForCancellation: input.minCancelHoursNotice !== undefined ? Number(input.minCancelHoursNotice) : undefined, autoConfirmPublicBookings: input.autoConfirmPublicBookings !== undefined ? Boolean(input.autoConfirmPublicBookings) : undefined, updatedAt: new Date() }
    const [settings] = existing ? await db.update(salonSettings).set(values).where(eq(salonSettings.id, existing.id)).returning() : await db.insert(salonSettings).values({ id: crypto.randomUUID(), salonName: input.salonName?.trim() || 'Atelier Beauty Studio', currency: input.currency?.trim() || 'ARS', defaultDepositPercentage: Number(input.defaultDepositPercentage ?? 30), minNoticeHoursForCancellation: Number(input.minCancelHoursNotice ?? 24), autoConfirmPublicBookings: Boolean(input.autoConfirmPublicBookings ?? false) }).returning()
    revalidatePath('/'); revalidatePath('/reservar'); return { success: true, settings }
  } catch (error: any) { return { success: false, error: error.message || 'Error al actualizar configuraciones' } }
}
