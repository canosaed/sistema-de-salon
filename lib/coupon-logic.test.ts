import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCouponDiscount, validateCouponForBooking } from './coupon-logic'

const activeCoupon = {
  discountType: 'percentage',
  discountValue: 20,
  minimumPurchase: 1000,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  maxUses: 2,
  isActive: true,
}

test('calculates percentage and fixed discounts without exceeding the booking total', () => {
  assert.equal(calculateCouponDiscount(12500, 'percentage', 20), 2500)
  assert.equal(calculateCouponDiscount(12500, 'fixed', 15000), 12500)
  assert.equal(calculateCouponDiscount(100, 'percentage', 12.5), 12.5)
  assert.throws(() => calculateCouponDiscount(100, 'percentage', 101), /no puede superar/)
  assert.throws(() => calculateCouponDiscount(0, 'fixed', 100), /no es válido/)
})

test('validates coupon activation, date, minimum purchase, and usage limit', () => {
  assert.equal(validateCouponForBooking(activeCoupon, 5000, '2026-11-12', 1), 1000)
  assert.throws(() => validateCouponForBooking({ ...activeCoupon, isActive: false }, 5000, '2026-11-12', 0), /no está disponible/)
  assert.throws(() => validateCouponForBooking(activeCoupon, 5000, '2026-12-01', 0), /vigencia/)
  assert.throws(() => validateCouponForBooking(activeCoupon, 500, '2026-11-12', 0), /compra mínima/)
  assert.throws(() => validateCouponForBooking(activeCoupon, 5000, '2026-11-12', 2), /límite de usos/)
})
