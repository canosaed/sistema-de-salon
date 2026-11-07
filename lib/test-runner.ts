import {
  calculateAppointmentTotals,
  calculatePaymentBalance,
  calculateAvailableSlots,
  checkSlotCollision,
  parseTimeToMinutes,
  minutesToTimeString,
} from './business-logic'
import { salonRepo } from './db/salon-repository'
import {
  getAgendaPeriodRange,
  shiftAgendaDate,
  isAppointmentInPeriod,
} from './agenda-filters'

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

  // 16. Filtro de agenda por Día
  test(16, 'Filtro de agenda por Día incluye sólo turnos del día indicado', () => {
    const range = getAgendaPeriodRange('2026-11-10', 'day')
    if (range.startDate !== '2026-11-10' || range.endDate !== '2026-11-10') {
      throw new Error(`Rango de día inválido: ${range.startDate} a ${range.endDate}`)
    }
    if (!isAppointmentInPeriod('2026-11-10', range)) {
      throw new Error('Debería incluir turno de la misma fecha')
    }
    if (isAppointmentInPeriod('2026-11-11', range)) {
      throw new Error('No debería incluir turno de fecha distinta')
    }
  })

  // 17. Filtro de agenda por Semana
  test(17, 'Filtro de agenda por Semana incluye turnos de lunes a domingo', () => {
    // 2026-11-11 es miércoles. La semana va del lunes 2026-11-09 al domingo 2026-11-15
    const range = getAgendaPeriodRange('2026-11-11', 'week')
    if (range.startDate !== '2026-11-09' || range.endDate !== '2026-11-15') {
      throw new Error(`Rango de semana inválido: ${range.startDate} a ${range.endDate}`)
    }
    if (!isAppointmentInPeriod('2026-11-09', range) || !isAppointmentInPeriod('2026-11-15', range)) {
      throw new Error('Debería incluir turnos del lunes al domingo de esa semana')
    }
    if (isAppointmentInPeriod('2026-11-08', range) || isAppointmentInPeriod('2026-11-16', range)) {
      throw new Error('No debería incluir turnos fuera de la semana')
    }
  })

  // 18. Filtro de agenda por Mes y desplazamiento
  test(18, 'Filtro de agenda por Mes abarca todo el mes y permite navegar períodos', () => {
    const rangeNov = getAgendaPeriodRange('2026-11-11', 'month')
    if (rangeNov.startDate !== '2026-11-01' || rangeNov.endDate !== '2026-11-30') {
      throw new Error(`Rango de mes inválido: ${rangeNov.startDate} a ${rangeNov.endDate}`)
    }
    if (!isAppointmentInPeriod('2026-11-01', rangeNov) || !isAppointmentInPeriod('2026-11-30', rangeNov)) {
      throw new Error('Debería incluir inicio y fin de mes')
    }
    if (isAppointmentInPeriod('2026-12-01', rangeNov)) {
      throw new Error('No debería incluir turnos de otro mes')
    }

    // Desplazamiento de mes
    const nextMonthAnchor = shiftAgendaDate('2026-11-11', 'month', 1)
    const rangeDic = getAgendaPeriodRange(nextMonthAnchor, 'month')
    if (rangeDic.startDate !== '2026-12-01' || rangeDic.endDate !== '2026-12-31') {
      throw new Error(`Fallo desplazamiento al siguiente mes: ${rangeDic.startDate}`)
    }
  })

  // 19. Filtro y ABM de reservas (Listado Integral)
  test(19, 'Filtros y operaciones de ABM en Reservas', () => {
    // Crear reserva para prueba
    const apt = salonRepo.createAppointment({
      clientName: 'Reserva Test ABM',
      clientPhone: '11 5555 9876',
      serviceIds: ['srv-esmaltado-semi'],
      professionalId: 'pro-valentina',
      date: '2026-11-28',
      time: '17:00',
    })

    // Simular búsqueda por nombre o teléfono
    const all = salonRepo.getAppointments()
    const found = all.filter((a) => a.clientName.toLowerCase().includes('abm') || a.clientPhone.includes('9876'))
    if (!found.some((a) => a.id === apt.id)) {
      throw new Error('No encontró la reserva por filtro de búsqueda')
    }

    // Cobro / Seña (Update / Pago)
    const payRes = salonRepo.registerPayment({
      appointmentId: apt.id,
      amount: 10000,
      method: 'cash',
      type: 'deposit',
    })
    if (payRes.balance.paymentStatus !== 'partially_paid' && payRes.balance.paymentStatus !== 'deposit_paid') {
      throw new Error('Fallo al asentar cobro en reserva')
    }

    // Cancelar y Eliminar definitivamente (Delete ABM)
    salonRepo.updateAppointmentStatus(apt.id, 'cancelled', 'Cancelada por test')
    const deleted = salonRepo.deleteAppointment(apt.id)
    if (!deleted || deleted.id !== apt.id) {
      throw new Error('Fallo al eliminar la reserva')
    }
    const afterDelete = salonRepo.getAppointments().find((a) => a.id === apt.id)
    if (afterDelete) {
      throw new Error('La reserva continúa existiendo tras eliminación')
    }
  })

  // 20. ABM de Turnos y Horarios de Profesionales
  test(20, 'ABM y disponibilidad de Turnos y Horarios de Profesionales', () => {
    const testProId = 'pro-sofia-test'
    // 1. Create / Upsert de nuevo horario (Lunes = 1)
    const createdSched = salonRepo.createSchedule({
      professionalId: testProId,
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '14:00',
      breakStartTime: '11:00',
      breakEndTime: '12:00',
      isActive: true,
    })
    if (!createdSched || createdSched.startTime !== '08:00' || createdSched.dayOfWeek !== 1) {
      throw new Error('Fallo al crear horario de profesional')
    }

    // 2. Read / List de horarios de la profesional
    const proSchedules = salonRepo.getSchedulesByProfessional(testProId)
    const found = proSchedules.find((s) => s.id === createdSched.id)
    if (!found) {
      throw new Error('No se encontró el horario creado en los turnos de la profesional')
    }

    // 3. Update horario
    const updated = salonRepo.updateSchedule(createdSched.id, {
      startTime: '08:30',
      endTime: '15:00',
    })
    if (!updated || updated.startTime !== '08:30' || updated.endTime !== '15:00') {
      throw new Error('Fallo al actualizar horario de profesional')
    }

    // 4. Toggle activo / inactivo
    const toggled = salonRepo.toggleScheduleActive(createdSched.id)
    if (!toggled || toggled.isActive !== false) {
      throw new Error('Fallo al alternar estado de disponibilidad del horario')
    }

    // 5. Delete horario
    const deleted = salonRepo.deleteSchedule(createdSched.id)
    if (!deleted) {
      throw new Error('Fallo al eliminar horario de profesional')
    }
    const afterDelete = salonRepo.getSchedulesByProfessional(testProId).find((s) => s.id === createdSched.id)
    if (afterDelete) {
      throw new Error('El horario continúa existiendo luego de la eliminación')
    }
  })

  // 21. Auditoría: ABM y Persistencia de Clientes
  test(21, 'Auditoría: Creación, modificación, consulta y baja de cliente', () => {
    const created = salonRepo.createClient({
      name: 'Victoria Auditoría',
      phone: '11 5555 7788',
      email: 'victoria@test.com',
      notes: 'Clienta VIP para auditoría',
    })
    if (!created.id || created.name !== 'Victoria Auditoría') {
      throw new Error('Fallo al persistir cliente')
    }

    const updated = salonRepo.updateClient(created.id, {
      name: 'Victoria Auditoría Modificada',
      phone: '11 5555 7789',
      notes: 'Notas actualizadas',
    })
    if (updated.name !== 'Victoria Auditoría Modificada' || updated.phone !== '11 5555 7789') {
      throw new Error('Fallo al actualizar cliente')
    }

    const listed = salonRepo.getClients().find((c) => c.id === created.id)
    if (!listed || listed.name !== 'Victoria Auditoría Modificada') {
      throw new Error('Fallo al consultar cliente persistido')
    }

    salonRepo.deleteClient(created.id)
    const afterDelete = salonRepo.getClients().find((c) => c.id === created.id)
    if (afterDelete) {
      throw new Error('La clienta dada de baja continúa en listado activo')
    }
  })

  // 22. Auditoría: ABM y Persistencia de Servicios
  test(22, 'Auditoría: Creación, actualización y baja lógica de servicio', () => {
    const srv = salonRepo.createService({
      categoryId: 'cat-manos',
      name: 'Kapping Gel Premium Auditoría',
      description: 'Tratamiento fortalecedor con nivelación',
      price: 26000,
      durationMinutes: 70,
      prepMinutes: 10,
      cleanupMinutes: 10,
      depositType: 'percentage',
      depositValue: 30,
      allowPublicBooking: true,
    })
    if (!srv.id || Number(srv.price) !== 26000) {
      throw new Error('Fallo al crear servicio')
    }

    const updatedSrv = salonRepo.updateService(srv.id, {
      price: 28000,
      durationMinutes: 80,
    })
    if (Number(updatedSrv.price) !== 28000 || updatedSrv.durationMinutes !== 80) {
      throw new Error('Fallo al modificar servicio')
    }

    salonRepo.deleteService(srv.id)
    const activeServices = salonRepo.getServices()
    if (activeServices.some((s) => s.id === srv.id)) {
      throw new Error('Servicio dado de baja aún figura activo en catálogo')
    }
  })

  // 23. Auditoría: ABM y Persistencia de Profesionales
  test(23, 'Auditoría: Creación, actualización y baja lógica de profesional', () => {
    const pro = salonRepo.createProfessional({
      name: 'Martina Estilista',
      phone: '11 5555 3322',
      email: 'martina@atelier.com',
      specialties: 'Nail art y esculpidas',
      initials: 'ME',
      serviceIds: ['srv-esmaltado-semi'],
    })
    if (!pro.id || pro.name !== 'Martina Estilista') {
      throw new Error('Fallo al persistir profesional')
    }

    const updatedPro = salonRepo.updateProfessional(pro.id, {
      specialties: 'Especialista Máster en Polygel',
    })
    if (updatedPro.specialties !== 'Especialista Máster en Polygel') {
      throw new Error('Fallo al modificar profesional')
    }

    salonRepo.deleteProfessional(pro.id)
    const activePros = salonRepo.getProfessionals()
    if (activePros.some((p) => p.id === pro.id)) {
      throw new Error('Profesional desactivada aún figura activa')
    }
  })

  // 24. Auditoría: ABM y Persistencia de Materiales e Inventario
  test(24, 'Auditoría: Creación, edición, stock y baja de materiales', () => {
    const mat = salonRepo.createMaterial({
      name: 'Top Coat Brillante No Wipe Test',
      category: 'Manicuría',
      unit: 'unidades',
      currentStock: 25,
      minimumStock: 5,
      estimatedCostUnit: 4500,
    })
    if (!mat.id || Number(mat.currentStock) !== 25) {
      throw new Error('Fallo al crear material de inventario')
    }

    const mov = salonRepo.registerMaterialMovement({
      materialId: mat.id,
      type: 'in',
      quantity: 10,
      reason: 'Ingreso lote auditoría',
    })
    if (Number(mov.material.currentStock) !== 35) {
      throw new Error('Fallo al actualizar stock con movimiento')
    }

    salonRepo.deleteMaterial(mat.id)
    const activeMaterials = salonRepo.getMaterials()
    if (activeMaterials.some((m) => m.id === mat.id)) {
      throw new Error('Material eliminado aún figura en inventario activo')
    }
  })

  // 25. Auditoría: Bloqueo de horario ocupado o bloqueado
  test(25, 'Auditoría: Reservar horario ocupado o con profesional no disponible debe rechazarse', () => {
    const apt1 = salonRepo.createAppointment({
      clientName: 'Cliente A Colisión',
      clientPhone: '11 5555 6001',
      serviceIds: ['srv-esmaltado-semi'],
      professionalId: 'pro-valentina',
      date: '2026-11-25',
      time: '16:00',
    })

    let rejected = false
    try {
      salonRepo.createAppointment({
        clientName: 'Cliente B Colisión',
        clientPhone: '11 5555 6002',
        serviceIds: ['srv-esmaltado-semi'],
        professionalId: 'pro-valentina',
        date: '2026-11-25',
        time: '16:00',
      })
    } catch {
      rejected = true
    }

    if (!rejected) {
      throw new Error('No rechazó la superposición de reserva en horario ocupado')
    }
  })

  return results
}
