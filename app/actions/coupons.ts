'use server'

import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { couponRedemptions, coupons, services, techniques } from '@/lib/db/schema'
import { adminRoles, requireSalonRole } from '@/lib/staff-auth'
import { validateCouponForBooking, type CouponDiscountType } from '@/lib/coupon-logic'
import { calculateAppointmentTotals } from '@/lib/business-logic'
import { getSalonDateString } from '@/lib/salon-time'

export interface CouponInput {
  code: string
  description: string
  discountType: CouponDiscountType
  discountValue: number
  minimumPurchase: number
  startDate: string
  endDate: string
  maxUses: number | null
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function validateInput(input: CouponInput) {
  const code = input.code?.trim().toUpperCase()
  //Normalización Unicode (NFD vs NFC)
  const normalizedCode = code?.trim().normalize('NFC').toUpperCase();
  if (!normalizedCode || !/^[A-Z0-9Ñ_-]{3,30}$/.test(normalizedCode)) {
    throw new Error('El código debe tener entre 3 y 30 caracteres: letras, números, guion o guion bajo.');
  }
  // if (!code || !/^[A-Z0-9Ñ_-]{3,30}$/.test(code)) {
  //   throw new Error('El código debe tener entre 3 y 30 caracteres: letras, números, guion o guion bajo.')
  // }
  if (!input.description?.trim() || input.description.trim().length > 160) {
    throw new Error('La descripción debe tener entre 1 y 160 caracteres.')
  }
  if (!['percentage', 'fixed'].includes(input.discountType)) throw new Error('El tipo de descuento no es válido.')
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    throw new Error('El valor del descuento debe ser mayor a cero.')
  }
  if (input.discountType === 'percentage' && input.discountValue > 100) {
    throw new Error('El descuento porcentual no puede superar el 100%.')
  }
  if (!Number.isFinite(input.minimumPurchase) || input.minimumPurchase < 0) {
    throw new Error('La compra mínima no puede ser negativa.')
  }
  if (!isValidDate(input.startDate) || !isValidDate(input.endDate) || input.startDate > input.endDate) {
    throw new Error('Ingresá un período de vigencia válido.')
  }
  if (input.maxUses !== null && (!Number.isInteger(input.maxUses) || input.maxUses <= 0)) {
    throw new Error('El límite de usos debe ser un número entero mayor a cero.')
  }
  return { ...input, code, description: input.description.trim() }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export async function getCouponsAction() {
  await requireSalonRole(adminRoles)
  const [couponRows, redemptionCounts] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.createdAt)),
    db.select({ couponId: couponRedemptions.couponId, uses: count() })
      .from(couponRedemptions)
      .groupBy(couponRedemptions.couponId),
  ])
  const countsByCoupon = new Map(redemptionCounts.map(({ couponId, uses }) => [couponId, uses]))
  return couponRows.map((coupon) => ({
    ...coupon,
    discountValue: Number(coupon.discountValue),
    minimumPurchase: Number(coupon.minimumPurchase),
    uses: countsByCoupon.get(coupon.id) ?? 0,
  }))
}

export async function createCouponAction(input: CouponInput) {
  await requireSalonRole(adminRoles)
  const valid = validateInput(input)
  try {
    const [coupon] = await db.insert(coupons).values({
      id: crypto.randomUUID(),
      ...valid,
      discountValue: String(valid.discountValue),
      minimumPurchase: String(valid.minimumPurchase),
      isActive: true,
    }).returning()
    return coupon
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error('Ya existe una promoción con ese código.')
    throw error
  }
}

export async function setCouponActiveAction(id: string, isActive: boolean) {
  await requireSalonRole(adminRoles)
  if (!id) throw new Error('ID de cupón no provisto.')
  if (typeof isActive !== 'boolean') throw new Error('El estado de la promoción no es válido.')
  const [coupon] = await db.update(coupons)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(coupons.id, id))
    .returning()
  if (!coupon) throw new Error('No se encontró la promoción solicitada.')
  return coupon
}

export async function getPublicCouponAction(input: {
  code: string
  serviceId: string
  techniqueId?: string
}) {
  if (!input.code?.trim()) throw new Error('Ingresá un código de descuento.')
  if (!input.serviceId) {
    throw new Error('No se pudo validar el cupón para este servicio.')
  }

  const [service] = await db.select().from(services).where(and(
    eq(services.id, input.serviceId),
    eq(services.isActive, true),
    eq(services.allowPublicBooking, true),
  )).limit(1)
  if (!service) throw new Error('El servicio seleccionado no está disponible para reservas públicas.')
  const technique = input.techniqueId
    ? (await db.select().from(techniques).where(and(
      eq(techniques.id, input.techniqueId),
      eq(techniques.serviceId, service.id),
      eq(techniques.isActive, true),
    )).limit(1))[0]
    : undefined
  if (input.techniqueId && !technique) throw new Error('La técnica seleccionada no está disponible para este servicio.')

  const total = calculateAppointmentTotals([{
    serviceId: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    prepMinutes: service.prepMinutes,
    cleanupMinutes: service.cleanupMinutes,
    price: Number(service.price),
    additionalMinutes: technique?.additionalMinutes ?? 0,
    additionalPrice: Number(technique?.additionalPrice ?? 0),
  }]).totalPrice

  const [coupon] = await db.select().from(coupons)
    .where(sql`lower(${coupons.code}) = ${input.code.trim().toLowerCase()}`)
    .limit(1)
  if (!coupon) throw new Error('El código ingresado no es válido.')

  const [usage] = await db.select({ uses: count() })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, coupon.id))
  const today = getSalonDateString()
  const discountAmount = validateCouponForBooking(
    {
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minimumPurchase: Number(coupon.minimumPurchase),
    },
    total,
    today,
    usage?.uses ?? 0,
  )

  return {
    code: coupon.code,
    description: coupon.description,
    discountAmount,
    totalPrice: Math.max(0, Math.round((total - discountAmount + Number.EPSILON) * 100) / 100),
  }
}
