export type CouponDiscountType = 'percentage' | 'fixed'

export interface CouponForValidation {
  discountType: string
  discountValue: number
  minimumPurchase: number
  startDate: string
  endDate: string
  maxUses: number | null
  isActive: boolean
}

export function calculateCouponDiscount(
  total: number,
  discountType: string,
  discountValue: number,
) {
  if (!Number.isFinite(total) || total <= 0) throw new Error('El importe de la reserva no es válido.')
  if (!Number.isFinite(discountValue) || discountValue <= 0) throw new Error('El descuento configurado no es válido.')
  if (discountType === 'percentage' && discountValue > 100) {
    throw new Error('El descuento porcentual no puede superar el 100%.')
  }
  if (discountType !== 'percentage' && discountType !== 'fixed') {
    throw new Error('El tipo de descuento no es válido.')
  }

  const amount = discountType === 'percentage'
    ? total * discountValue / 100
    : Math.min(total, discountValue)
  return Math.min(total, Math.round((amount + Number.EPSILON) * 100) / 100)
}

export function validateCouponForBooking(
  coupon: CouponForValidation,
  total: number,
  today: string,
  redemptionCount: number,
) {
  if (!coupon.isActive) throw new Error('Este cupón no está disponible.')
  if (today < coupon.startDate || today > coupon.endDate) {
    throw new Error('Este cupón está fuera de su período de vigencia.')
  }
  if (total < coupon.minimumPurchase) {
    throw new Error(`El cupón requiere una compra mínima de $${coupon.minimumPurchase.toLocaleString('es-AR')} ARS.`)
  }
  if (coupon.maxUses !== null && redemptionCount >= coupon.maxUses) {
    throw new Error('Este cupón ya alcanzó su límite de usos.')
  }
  if (total <= 0) throw new Error('El cupón no puede aplicarse a una reserva sin costo.')

  return calculateCouponDiscount(total, coupon.discountType, coupon.discountValue)
}
