import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateAppointmentTotals,
  calculateAvailableSlots,
  calculatePaymentBalance,
  checkSlotCollision,
} from './business-logic'
import { getSalonDateString } from './salon-time'

test('salon date follows Argentina time instead of the host UTC date', () => {
  assert.equal(getSalonDateString(new Date('2026-11-10T02:59:00.000Z')), '2026-11-09')
  assert.equal(getSalonDateString(new Date('2026-11-10T03:00:00.000Z')), '2026-11-10')
})

test('sums sequential service durations, preparation, cleanup, and price', () => {
  const totals = calculateAppointmentTotals([
    { serviceId: 's1', name: 'Manicuría', durationMinutes: 40, prepMinutes: 5, cleanupMinutes: 10, price: 15000 },
    { serviceId: 's2', name: 'Nail art', durationMinutes: 20, cleanupMinutes: 5, price: 5000 },
  ])
  assert.deepEqual(totals, {
    netDurationMinutes: 60,
    totalPrepMinutes: 5,
    totalCleanupMinutes: 15,
    totalOccupiedDurationMinutes: 80,
    totalPrice: 20000,
  })
})

test('availability respects the working window, break, existing appointments, and blocks', () => {
  const slots = calculateAvailableSlots({
    dateStr: '2026-11-16',
    schedule: {
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '13:00',
      breakStartTime: '11:00',
      breakEndTime: '12:00',
      isActive: true,
    },
    existingAppointments: [{ startMinutes: 540, endMinutes: 570, status: 'confirmed' }],
    blocks: [{ startMinutes: 720, endMinutes: 750 }],
    totalDurationMinutes: 60,
  })
  assert.deepEqual(slots, ['09:30', '10:00'])
})

test('collision detection ignores adjacent and cancelled bookings', () => {
  assert.equal(checkSlotCollision(
    { startMinutes: 600, endMinutes: 660 },
    [{ id: 'a', startMinutes: 540, endMinutes: 600, status: 'confirmed' }],
  ), false)
  assert.equal(checkSlotCollision(
    { startMinutes: 600, endMinutes: 660 },
    [{ id: 'a', startMinutes: 630, endMinutes: 690, status: 'confirmed' }],
  ), true)
  assert.equal(checkSlotCollision(
    { startMinutes: 600, endMinutes: 660 },
    [{ id: 'a', startMinutes: 630, endMinutes: 690, status: 'cancelled' }],
  ), false)
})

test('payment balance accounts for deposits and refunds', () => {
  assert.deepEqual(calculatePaymentBalance(20000, [
    { amount: 6000, type: 'deposit' },
    { amount: 1000, type: 'refund' },
  ]), {
    totalPrice: 20000,
    totalPaid: 5000,
    balancePending: 15000,
    paymentStatus: 'deposit_paid',
  })
})
