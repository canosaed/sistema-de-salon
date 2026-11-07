'use server'

import { salonRepo } from '@/lib/db/salon-repository'
import { revalidatePath } from 'next/cache'

export interface SalonSettingsInput {
  salonName?: string
  currency?: string
  defaultDepositPercentage?: number
  minCancelHoursNotice?: number
  autoConfirmPublicBookings?: boolean
  allowSimultaneousServices?: boolean
  cancellationPolicyText?: string
  businessHoursStart?: string
  businessHoursEnd?: string
}

export async function getSalonSettingsAction() {
  try {
    const settings = salonRepo.getSettings()
    return { success: true, settings }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al obtener configuraciones' }
  }
}

export async function updateSalonSettingsAction(input: SalonSettingsInput) {
  try {
    const updated = salonRepo.updateSettings({
      salonName: input.salonName?.trim(),
      currency: input.currency?.trim(),
      defaultDepositPercentage:
        input.defaultDepositPercentage !== undefined ? Number(input.defaultDepositPercentage) : undefined,
      minCancelHoursNotice:
        input.minCancelHoursNotice !== undefined ? Number(input.minCancelHoursNotice) : undefined,
      autoConfirmPublicBookings:
        input.autoConfirmPublicBookings !== undefined ? Boolean(input.autoConfirmPublicBookings) : undefined,
      allowSimultaneousServices:
        input.allowSimultaneousServices !== undefined ? Boolean(input.allowSimultaneousServices) : undefined,
      cancellationPolicyText: input.cancellationPolicyText?.trim(),
      businessHoursStart: input.businessHoursStart?.trim(),
      businessHoursEnd: input.businessHoursEnd?.trim(),
    })

    revalidatePath('/')
    revalidatePath('/reservar')
    return { success: true, settings: updated }
  } catch (error: any) {
    return { success: false, error: error.message || 'Error al actualizar configuraciones' }
  }
}
