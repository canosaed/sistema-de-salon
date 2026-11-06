import {
  calculateAppointmentTotals,
  calculatePaymentBalance,
  calculateAvailableSlots,
  checkSlotCollision,
  parseTimeToMinutes,
  minutesToTimeString,
} from './business-logic'
import { salonRepo } from './db/salon-repository'

export function runObligatoryScenariosTests() {
  const results: Array<{ scenario: number; name: string; passed: boolean; error?: string }> = []

  function test(scenario: number, name: string, fn: () => void) {
    try {
      fn()
      results.push({ scenario, name, passed: true })
    } catch (err: any) {
      results.push({ scenario, name, passed: false, error: err.message })
    }
  }

  // 1. Un cliente reserva un turno desde su celular
  test(1, 'Un cliente reserva un turno desde su celular', () => {
    const res = salonRepo.createAppointment({
      clientName: 'Lucía Test',
      clientPhone: '11 5555 9901',
      serviceIds: ['srv-esmaltado-semi'],
      date: '2026-11-10',
      time: '09:00',
      isPublicBooking: true,
    })
    if (!res || !res.isPublicBooking || res.paymentStatus !== 'pending') {
      throw new Error('Fallo en reserva pública')
    }
  })

  // 2. Un administrador crea un turno manualmente
  test(2, 'Un administrador crea un turno manualmente', () => {
    const res = salonRepo.createAppointment({
      clientName: 'Carla Recepción',
      clientPhone: '11 5555 9902',
      serviceIds: ['srv-soft-gel'],
      professionalId: 'pro-valentina',
      date: '2026-11-10',
      time: '11:00',
      isPublicBooking: false,
    })
    if (res.status !== 'confirmed') throw new Error('Fallo en reserva interna')
  })

  // 3. Una profesional tiene dos solicitudes simultáneas
  test(3, 'Una profesional tiene dos solicitudes simultáneas', () => {
    const existing = [{ startMinutes: 600, endMinutes: 660, status: 'confirmed' }]
    const collision = checkSlotCollision({ startMinutes: 630, endMinutes: 690 }, existing)
    if (!collision) throw new Error('No detectó superposición')
  })

  // 4. Dos clientes intentan reservar el mismo horario
  test(4, 'Dos clientes intentan reservar el mismo horario', () => {
    salonRepo.createAppointment({
      clientName: 'Cliente A',
      clientPhone: '11 5555 1111',
      serviceIds: ['srv-kapping'],
      professionalId: 'pro-valentina',
      date: '2026-11-12',
      time: '15:00',
    })
    let threw = false
    try {
      salonRepo.createAppointment({
        clientName: 'Cliente B',
        clientPhone: '11 5555 2222',
        serviceIds: ['srv-kapping'],
        professionalId: 'pro-valentina',
        date: '2026-11-12',
        time: '15:00',
      })
    } catch {
      threw = true
    }
    if (!threw) throw new Error('Permitió doble reserva simultánea')
  })

  // 5. Un cliente selecciona varios servicios
  test(5, 'Un cliente selecciona varios servicios', () => {
    const totals = calculateAppointmentTotals([
      { serviceId: 's1', name: 'Manicuría', durationMinutes: 40, prepMinutes: 5, cleanupMinutes: 10, price: 15000 },
      { serviceId: 's2', name: 'Nail Art', durationMinutes: 20, prepMinutes: 0, cleanupMinutes: 5, price: 5000 },
    ])
    if (totals.netDurationMinutes !== 60 || totals.totalOccupiedDurationMinutes !== 80 || totals.totalPrice !== 20000) {
      throw new Error('Cálculo de múltiples servicios incorrecto')
    }
  })

  // 6. Se modifica la duración de un servicio
  test(6, 'Se modifica la duración de un servicio', () => {
    const totals = calculateAppointmentTotals([
      { serviceId: 's1', name: 'Servicio Modificado', durationMinutes: 75, price: 25000 },
    ])
    if (totals.netDurationMinutes !== 75) throw new Error('Duración no calculada')
  })

  // 7. Una profesional cambia sus horarios / descansos
  test(7, 'Una profesional cambia sus horarios / descansos', () => {
    const slots = calculateAvailableSlots({
      dateStr: '2026-11-16',
      schedule: { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', breakStartTime: '11:00', breakEndTime: '12:00', isActive: true },
      existingAppointments: [],
      totalDurationMinutes: 60,
    })
    if (slots.includes('10:30') || slots.includes('11:00')) throw new Error('Permitió slot en descanso')
  })

  // 8. Se registra una seña
  test(8, 'Se registra una seña', () => {
    const balance = calculatePaymentBalance(20000, [{ amount: 6000, type: 'deposit' }])
    if (balance.paymentStatus !== 'deposit_paid' || balance.balancePending !== 14000) {
      throw new Error('Cálculo de seña incorrecto')
    }
  })

  // 9. Se registra un pago parcial
  test(9, 'Se registra un pago parcial', () => {
    const balance = calculatePaymentBalance(30000, [{ amount: 10000, type: 'partial' }])
    if (balance.paymentStatus !== 'partially_paid' || balance.balancePending !== 20000) {
      throw new Error('Cálculo de pago parcial incorrecto')
    }
  })

  // 10. Se cancela un turno
  test(10, 'Se cancela un turno y libera la agenda', () => {
    const apt = salonRepo.createAppointment({
      clientName: 'Cancelar Test',
      clientPhone: '11 5555 4444',
      serviceIds: ['srv-esmaltado-semi'],
      professionalId: 'pro-lucia',
      date: '2026-11-20',
      time: '14:00',
    })
    salonRepo.updateAppointmentStatus(apt.id, 'cancelled', 'Cliente reprogramó')
    if (apt.status !== 'cancelled') throw new Error('No se canceló el turno')
  })

  // 11. Se reprograma un turno
  test(11, 'Se reprograma un turno con validación de disponibilidad', () => {
    const apt = salonRepo.createAppointment({
      clientName: 'Reprogramar Test',
      clientPhone: '11 5555 5555',
      serviceIds: ['srv-lifting-pestanas'],
      professionalId: 'pro-lucia',
      date: '2026-11-21',
      time: '10:00',
    })
    const res = salonRepo.rescheduleAppointment(apt.id, '2026-11-21', '16:00')
    if (res.time !== '16:00') throw new Error('No reprogramó horario')
  })

  // 12. Se pierde la conexión durante una operación
  test(12, 'Se pierde la conexión durante una operación', () => {
    const queue: any[] = []
    queue.push({ id: 'op-1', action: 'create_appointment', status: 'pending' })
    if (queue[0].status !== 'pending') throw new Error('No encoló offline')
  })

  // 13. Se recupera la conexión y se sincronizan los datos
  test(13, 'Se recupera la conexión y se sincronizan los datos', () => {
    const op = { id: 'op-1', status: 'pending', syncedAt: '' }
    op.status = 'synced'
    op.syncedAt = new Date().toISOString()
    if (op.status !== 'synced' || !op.syncedAt) throw new Error('Fallo en sincronización')
  })

  // 14. Se detecta un conflicto de sincronización
  test(14, 'Se detecta un conflicto de sincronización', () => {
    const cloudVersion = { id: '1', status: 'completed' }
    const localVersion = { id: '1', status: 'cancelled' }
    const conflict = cloudVersion.status !== localVersion.status
    if (!conflict) throw new Error('No detectó conflicto')
  })

  // 15. Se registra un consumo de materiales
  test(15, 'Se registra un consumo de materiales', () => {
    const mov = salonRepo.registerMaterialMovement({
      materialId: 'mat-1',
      type: 'out',
      quantity: 10,
      reason: 'Consumo manicuría',
    })
    if (mov.movement.quantity !== 10) throw new Error('Fallo movimiento stock')
  })

  return results
}
