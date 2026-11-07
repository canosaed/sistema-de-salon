import { initialSeedData } from './seed-data'
import {
  calculateAppointmentTotals,
  calculateAvailableSlots,
  checkSlotCollision,
  parseTimeToMinutes,
  minutesToTimeString,
} from '../business-logic'

// Estructura del repositorio en memoria con soporte de persistencia híbrida
class SalonRepository {
  private categories = [...initialSeedData.categories]
  private services = [...initialSeedData.services]
  private techniques = [...initialSeedData.techniques]
  private materials = [...initialSeedData.materials]
  private professionals = [...initialSeedData.professionals]
  private professionalServices = [...initialSeedData.professionalServices]
  private schedules = [...initialSeedData.professionalSchedules]
  private absences: Array<{ id: string; professionalId: string; startDate: string; endDate: string; reason: string }> = []
  private blocks: Array<{ id: string; professionalId?: string | null; startDateTime: string; endDateTime: string; reason: string }> = []
  private clients = [...initialSeedData.initialClients]
  private appointments: Array<any> = [
    {
      id: 'apt-demo-1',
      clientId: 'cli-1',
      professionalId: 'pro-valentina',
      clientName: 'Sofía Martínez',
      clientPhone: '11 5555 0182',
      serviceName: 'Esmaltado semipermanente',
      date: new Date().toISOString().split('T')[0], // hoy
      time: '10:30',
      startMinutes: parseTimeToMinutes('10:30'),
      endMinutes: parseTimeToMinutes('10:30') + 65,
      totalDurationMinutes: 65,
      totalPrice: 18500,
      requiredDeposit: 5550,
      status: 'confirmed',
      paymentStatus: 'deposit_paid',
      isPublicBooking: false,
      notes: 'Turno agendado en recepción',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'apt-demo-2',
      clientId: 'cli-2',
      professionalId: 'pro-lucia',
      clientName: 'Camila Torres',
      clientPhone: '11 5555 0227',
      serviceName: 'Lifting de pestañas',
      date: new Date().toISOString().split('T')[0], // hoy
      time: '12:00',
      startMinutes: parseTimeToMinutes('12:00'),
      endMinutes: parseTimeToMinutes('12:00') + 75,
      totalDurationMinutes: 75,
      totalPrice: 22000,
      requiredDeposit: 6000,
      status: 'pending_confirmation',
      paymentStatus: 'pending',
      isPublicBooking: true,
      notes: 'Reserva online',
      createdAt: new Date().toISOString(),
    },
  ]
  private appointmentServices: Array<any> = []
  private payments: Array<any> = [
    {
      id: 'pay-demo-1',
      appointmentId: 'apt-demo-1',
      amount: 5550,
      method: 'transfer',
      type: 'deposit',
      status: 'completed',
      notes: 'Seña 30% por transferencia bancaria',
      createdAt: new Date().toISOString(),
    },
  ]
  private inventoryMovements: Array<any> = []
  private settings = { ...initialSeedData.settings }

  // -------------------------
  // MÉTODOS DE CONSULTA
  // -------------------------
  getCategories() {
    return this.categories
  }

  getServices() {
    return this.services.filter((s) => s.isActive)
  }

  getTechniques() {
    return this.techniques.filter((t) => t.isActive)
  }

  getMaterials() {
    return this.materials.filter((m) => m.isActive)
  }

  getProfessionals() {
    return this.professionals.filter((p) => p.isActive)
  }

  getSchedules() {
    return this.schedules
  }

  getClients() {
    return this.clients.filter((c) => c.isActive)
  }

  getAppointments() {
    return this.appointments
  }

  getPayments() {
    return this.payments
  }

  getSettings() {
    return this.settings
  }

  getInventoryMovements() {
    return this.inventoryMovements
  }

  // -------------------------
  // CLIENTES
  // -------------------------
  findOrCreateClient(data: { name: string; phone: string; email?: string; notes?: string }) {
    const cleanPhone = data.phone.trim().replace(/\s+/g, '')
    let client = this.clients.find((c) => c.phone.trim().replace(/\s+/g, '') === cleanPhone)

    if (!client) {
      client = {
        id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: null,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        birthDate: null,
        notes: data.notes?.trim() || null,
        preferences: null,
        visits: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.clients.push(client)
    } else {
      // Actualizar datos si se proporcionó email y no lo tenía
      if (data.email && !client.email) {
        client.email = data.email.trim()
      }
    }
    return client
  }

  createClient(input: { name: string; phone: string; email?: string; notes?: string }) {
    const newClient = {
      id: `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: null,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      birthDate: null,
      notes: input.notes?.trim() || null,
      preferences: null,
      visits: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.clients.unshift(newClient)
    return newClient
  }

  updateClient(id: string, input: { name: string; phone: string; email?: string; notes?: string }) {
    const client = this.clients.find((c) => c.id === id)
    if (!client) throw new Error('Cliente no encontrado')
    client.name = input.name.trim()
    client.phone = input.phone.trim()
    if (input.email !== undefined) client.email = input.email.trim() || null
    if (input.notes !== undefined) client.notes = input.notes.trim() || null
    client.updatedAt = new Date()
    return client
  }

  deleteClient(id: string) {
    const client = this.clients.find((c) => c.id === id)
    if (client) {
      client.isActive = false
    }
  }

  // -------------------------
  // ABM (CRUD) SERVICIOS
  // -------------------------
  createService(input: {
    categoryId: string
    name: string
    description?: string
    price: number
    durationMinutes: number
    prepMinutes?: number
    cleanupMinutes?: number
    depositType?: 'fixed' | 'percentage'
    depositValue?: number
    allowPublicBooking?: boolean
  }) {
    const newService = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: input.price.toFixed(2),
      durationMinutes: input.durationMinutes,
      prepMinutes: input.prepMinutes || 0,
      cleanupMinutes: input.cleanupMinutes || 0,
      depositType: input.depositType || 'percentage',
      depositValue: (input.depositValue ?? 30).toFixed(2),
      allowPublicBooking: input.allowPublicBooking ?? true,
      isActive: true,
      cancellationPolicy: 'Aviso con 24 hs de anticipación.',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.services.unshift(newService)
    return newService
  }

  updateService(
    id: string,
    input: {
      categoryId?: string
      name?: string
      description?: string
      price?: number
      durationMinutes?: number
      prepMinutes?: number
      cleanupMinutes?: number
      depositType?: 'fixed' | 'percentage'
      depositValue?: number
      allowPublicBooking?: boolean
    }
  ) {
    const srv = this.services.find((s) => s.id === id)
    if (!srv) throw new Error('Servicio no encontrado')

    if (input.categoryId !== undefined) srv.categoryId = input.categoryId
    if (input.name !== undefined) srv.name = input.name.trim()
    if (input.description !== undefined) srv.description = input.description.trim() || null
    if (input.price !== undefined) srv.price = input.price.toFixed(2)
    if (input.durationMinutes !== undefined) srv.durationMinutes = input.durationMinutes
    if (input.prepMinutes !== undefined) srv.prepMinutes = input.prepMinutes
    if (input.cleanupMinutes !== undefined) srv.cleanupMinutes = input.cleanupMinutes
    if (input.depositType !== undefined) srv.depositType = input.depositType
    if (input.depositValue !== undefined) srv.depositValue = input.depositValue.toFixed(2)
    if (input.allowPublicBooking !== undefined) srv.allowPublicBooking = input.allowPublicBooking
    srv.updatedAt = new Date()

    return srv
  }

  deleteService(id: string) {
    const srv = this.services.find((s) => s.id === id)
    if (srv) {
      // Baja lógica para conservar integridad de turnos históricos
      srv.isActive = false
      srv.updatedAt = new Date()
    }
    return { success: true }
  }

  // -------------------------
  // ABM (CRUD) PROFESIONALES
  // -------------------------
  createProfessional(input: {
    name: string
    phone: string
    email?: string
    specialties?: string
    initials?: string
    serviceIds?: string[]
  }) {
    const initials = input.initials || input.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)
    const newPro = {
      id: `pro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: null,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      specialties: input.specialties?.trim() || null,
      initials,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.professionals.push(newPro)

    // Asignar servicios habilitados
    if (input.serviceIds && input.serviceIds.length > 0) {
      for (const serviceId of input.serviceIds) {
        this.professionalServices.push({
          id: `ps-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          professionalId: newPro.id,
          serviceId,
        })
      }
    }

    // Horarios por defecto (Lunes a Viernes 09:00 - 18:00 con descanso 13:00 - 14:00)
    for (const day of [1, 2, 3, 4, 5]) {
      this.schedules.push({
        id: `sched-${newPro.id}-${day}`,
        professionalId: newPro.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
        isActive: true,
      })
    }

    return newPro
  }

  updateProfessional(
    id: string,
    input: {
      name?: string
      phone?: string
      email?: string
      specialties?: string
      initials?: string
      serviceIds?: string[]
    }
  ) {
    const pro = this.professionals.find((p) => p.id === id)
    if (!pro) throw new Error('Profesional no encontrada')

    if (input.name !== undefined) pro.name = input.name.trim()
    if (input.phone !== undefined) pro.phone = input.phone.trim()
    if (input.email !== undefined) pro.email = input.email.trim() || null
    if (input.specialties !== undefined) pro.specialties = input.specialties.trim() || null
    if (input.initials !== undefined) pro.initials = input.initials.trim()
    pro.updatedAt = new Date()

    if (input.serviceIds) {
      // Reasignar servicios
      this.professionalServices = this.professionalServices.filter((ps) => ps.professionalId !== id)
      for (const serviceId of input.serviceIds) {
        this.professionalServices.push({
          id: `ps-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          professionalId: id,
          serviceId,
        })
      }
    }

    return pro
  }

  deleteProfessional(id: string) {
    const pro = this.professionals.find((p) => p.id === id)
    if (pro) {
      // Baja lógica según regla 4.6 (conservar historial)
      pro.isActive = false
      pro.updatedAt = new Date()
    }
    return { success: true }
  }

  // -------------------------
  // DISPONIBILIDAD
  // -------------------------
  getAvailableSlots(params: {
    serviceId: string
    techniqueId?: string
    professionalId?: string // si es 'any' o vacío, evalúa cualquiera
    dateStr: string // "YYYY-MM-DD"
  }) {
    const service = this.services.find((s) => s.id === params.serviceId)
    if (!service) throw new Error('Servicio no encontrado')

    const tech = params.techniqueId ? this.techniques.find((t) => t.id === params.techniqueId) : null

    const totals = calculateAppointmentTotals([
      {
        serviceId: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        prepMinutes: service.prepMinutes,
        cleanupMinutes: service.cleanupMinutes,
        price: Number(service.price),
        additionalMinutes: tech?.additionalMinutes || 0,
        additionalPrice: Number(tech?.additionalPrice || 0),
      },
    ])

    // Determinar qué profesionales están habilitadas para este servicio
    const eligibleProIds = this.professionalServices
      .filter((ps) => ps.serviceId === service.id)
      .map((ps) => ps.professionalId)

    let candidatePros = this.professionals.filter((p) => p.isActive && eligibleProIds.includes(p.id))

    if (params.professionalId && params.professionalId !== 'any') {
      candidatePros = candidatePros.filter((p) => p.id === params.professionalId)
    }

    if (candidatePros.length === 0) {
      return { slots: [], availableProfessionals: [] }
    }

    // Día de la semana en la fecha indicada (0 = Domingo)
    // Crear la fecha asegurando interpretación local "YYYY-MM-DD"
    const [year, month, day] = params.dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const dayOfWeek = dateObj.getDay()

    const allSlotsMap = new Map<string, string[]>() // time -> [proIds]

    for (const pro of candidatePros) {
      const schedule = this.schedules.find((s) => s.professionalId === pro.id && s.dayOfWeek === dayOfWeek && s.isActive) || null
      if (!schedule) continue

      const proAbsences = this.absences.filter((a) => a.professionalId === pro.id)
      const proBlocks = this.blocks
        .filter((b) => !b.professionalId || b.professionalId === pro.id)
        .filter((b) => b.startDateTime.startsWith(params.dateStr))
        .map((b) => ({
          startMinutes: parseTimeToMinutes(b.startDateTime.split('T')[1].substring(0, 5)),
          endMinutes: parseTimeToMinutes(b.endDateTime.split('T')[1].substring(0, 5)),
        }))

      const proAppointments = this.appointments
        .filter((a) => a.professionalId === pro.id && a.date === params.dateStr && a.status !== 'cancelled')
        .map((a) => ({
          startMinutes: a.startMinutes,
          endMinutes: a.endMinutes,
          status: a.status,
        }))

      const availableTimes = calculateAvailableSlots({
        dateStr: params.dateStr,
        schedule,
        existingAppointments: proAppointments,
        absences: proAbsences,
        blocks: proBlocks,
        totalDurationMinutes: totals.totalOccupiedDurationMinutes,
      })

      for (const time of availableTimes) {
        const list = allSlotsMap.get(time) || []
        list.push(pro.id)
        allSlotsMap.set(time, list)
      }
    }

    const sortedSlots = Array.from(allSlotsMap.keys()).sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))

    return {
      slots: sortedSlots.map((time) => ({
        time,
        availableProfessionalIds: allSlotsMap.get(time) || [],
      })),
      totalDurationMinutes: totals.totalOccupiedDurationMinutes,
      totalPrice: totals.totalPrice,
      depositAmount:
        service.depositType === 'fixed'
          ? Number(service.depositValue)
          : Math.round((totals.totalPrice * Number(service.depositValue)) / 100),
      eligibleProfessionals: candidatePros,
    }
  }

  // -------------------------
  // CREACIÓN DE TURNOS / RESERVAS
  // -------------------------
  createAppointment(input: {
    clientId?: string
    clientName: string
    clientPhone: string
    clientEmail?: string
    serviceIds: string[]
    techniqueIds?: string[]
    professionalId?: string // si es 'any', asigna la primera disponible
    date: string // "YYYY-MM-DD"
    time: string // "HH:MM"
    notes?: string
    isPublicBooking?: boolean
  }) {
    // 1. Cliente
    let client
    if (input.clientId) {
      client = this.clients.find((c) => c.id === input.clientId)
    }
    if (!client) {
      client = this.findOrCreateClient({
        name: input.clientName,
        phone: input.clientPhone,
        email: input.clientEmail,
        notes: input.notes,
      })
    }

    // 2. Servicios
    const selectedServices = this.services.filter((s) => input.serviceIds.includes(s.id))
    if (selectedServices.length === 0) throw new Error('Debe seleccionar al menos un servicio válido.')

    const serviceInputs = selectedServices.map((srv, index) => {
      const techId = input.techniqueIds?.[index]
      const tech = techId ? this.techniques.find((t) => t.id === techId) : undefined
      return {
        serviceId: srv.id,
        name: srv.name,
        durationMinutes: srv.durationMinutes,
        prepMinutes: srv.prepMinutes,
        cleanupMinutes: srv.cleanupMinutes,
        price: Number(srv.price),
        techniqueId: tech?.id,
        techniqueName: tech?.name,
        additionalMinutes: tech?.additionalMinutes || 0,
        additionalPrice: Number(tech?.additionalPrice || 0),
      }
    })

    const totals = calculateAppointmentTotals(serviceInputs)
    const startMinutes = parseTimeToMinutes(input.time)
    const endMinutes = startMinutes + totals.totalOccupiedDurationMinutes

    // 3. Determinar Profesional asignada
    let assignedProId = input.professionalId

    if (!assignedProId || assignedProId === 'any') {
      // Buscar primera profesional disponible sin colisión
      const primaryService = selectedServices[0]
      const eligibleProIds = this.professionalServices
        .filter((ps) => ps.serviceId === primaryService.id)
        .map((ps) => ps.professionalId)

      const availablePro = this.professionals.find((p) => {
        if (!p.isActive || !eligibleProIds.includes(p.id)) return false
        const existingSlots = this.appointments
          .filter((a) => a.professionalId === p.id && a.date === input.date && a.status !== 'cancelled')
          .map((a) => ({ id: a.id, startMinutes: a.startMinutes, endMinutes: a.endMinutes, status: a.status }))
        return !checkSlotCollision({ startMinutes, endMinutes }, existingSlots)
      })

      if (!availablePro) {
        throw new Error('No hay profesionales disponibles en el horario seleccionado.')
      }
      assignedProId = availablePro.id
    } else {
      // Validar colisión para la profesional elegida
      const existingSlots = this.appointments
        .filter((a) => a.professionalId === assignedProId && a.date === input.date && a.status !== 'cancelled')
        .map((a) => ({ id: a.id, startMinutes: a.startMinutes, endMinutes: a.endMinutes, status: a.status }))

      const hasCollision = checkSlotCollision({ startMinutes, endMinutes }, existingSlots)
      if (hasCollision) {
        throw new Error('El horario seleccionado ya no está disponible para la profesional.')
      }
    }

    const assignedPro = this.professionals.find((p) => p.id === assignedProId)!

    // Cálculo de seña
    const primaryService = selectedServices[0]
    const depositAmount =
      primaryService.depositType === 'fixed'
        ? Number(primaryService.depositValue)
        : Math.round((totals.totalPrice * Number(primaryService.depositValue)) / 100)

    const initialStatus = input.isPublicBooking && !this.settings.autoConfirmPublicBookings
      ? 'pending_confirmation'
      : 'confirmed'

    const appointment = {
      id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      clientId: client.id,
      professionalId: assignedProId,
      clientName: client.name,
      clientPhone: client.phone,
      serviceName: selectedServices.map((s) => s.name).join(' + '),
      professional: assignedPro.name,
      date: input.date,
      time: input.time,
      startMinutes,
      endMinutes,
      totalDurationMinutes: totals.totalOccupiedDurationMinutes,
      totalPrice: totals.totalPrice,
      requiredDeposit: depositAmount,
      status: initialStatus,
      paymentStatus: 'pending',
      notes: input.notes || '',
      isPublicBooking: Boolean(input.isPublicBooking),
      createdAt: new Date().toISOString(),
    }

    this.appointments.unshift(appointment)
    client.visits += 1

    return appointment
  }

  // -------------------------
  // MODIFICACIONES Y CANCELACIONES
  // -------------------------
  updateAppointmentStatus(
    id: string,
    status: 'pending_confirmation' | 'confirmed' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show',
    reason?: string
  ) {
    const apt = this.appointments.find((a) => a.id === id)
    if (!apt) throw new Error('Turno no encontrado')
    apt.status = status
    if (reason) apt.cancellationReason = reason
    return apt
  }

  rescheduleAppointment(id: string, newDate: string, newTime: string) {
    const apt = this.appointments.find((a) => a.id === id)
    if (!apt) throw new Error('Turno no encontrado')

    const startMinutes = parseTimeToMinutes(newTime)
    const endMinutes = startMinutes + apt.totalDurationMinutes

    const existingSlots = this.appointments
      .filter((a) => a.professionalId === apt.professionalId && a.date === newDate && a.status !== 'cancelled')
      .map((a) => ({ id: a.id, startMinutes: a.startMinutes, endMinutes: a.endMinutes, status: a.status }))

    const hasCollision = checkSlotCollision({ startMinutes, endMinutes, appointmentId: apt.id }, existingSlots)
    if (hasCollision) {
      throw new Error('El nuevo horario tiene superposición con otro turno.')
    }

    apt.date = newDate
    apt.time = newTime
    apt.startMinutes = startMinutes
    apt.endMinutes = endMinutes
    return apt
  }

  // -------------------------
  // PAGOS Y SEÑAS
  // -------------------------
  registerPayment(input: {
    appointmentId: string
    amount: number
    method: 'cash' | 'transfer' | 'card' | 'other'
    type: 'deposit' | 'partial' | 'full' | 'refund'
    notes?: string
  }) {
    const apt = this.appointments.find((a) => a.id === input.appointmentId)
    if (!apt) throw new Error('Turno no encontrado')

    const payment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      appointmentId: input.appointmentId,
      amount: input.amount,
      method: input.method,
      type: input.type,
      status: 'completed',
      notes: input.notes || '',
      createdAt: new Date().toISOString(),
    }

    this.payments.unshift(payment)

    // Recalcular saldo y estado del pago
    const aptPayments = this.payments.filter((p) => p.appointmentId === apt.id)
    const balance = this.calculateBalance(apt.totalPrice, aptPayments)
    apt.paymentStatus = balance.paymentStatus

    return { payment, balance }
  }

  calculateBalance(totalPrice: number, aptPayments: any[]) {
    let totalPaid = 0
    for (const p of aptPayments) {
      if (p.type === 'refund') totalPaid -= p.amount
      else totalPaid += p.amount
    }
    const balancePending = Math.max(0, totalPrice - totalPaid)
    let paymentStatus: 'pending' | 'deposit_paid' | 'partially_paid' | 'paid' | 'refunded' = 'pending'

    if (totalPaid <= 0 && aptPayments.some((p) => p.type === 'refund')) paymentStatus = 'refunded'
    else if (totalPaid >= totalPrice && totalPrice > 0) paymentStatus = 'paid'
    else if (totalPaid > 0 && totalPaid < totalPrice) {
      const hasDeposit = aptPayments.some((p) => p.type === 'deposit')
      paymentStatus = hasDeposit ? 'deposit_paid' : 'partially_paid'
    } else {
      paymentStatus = 'pending'
    }

    return { totalPaid, balancePending, paymentStatus }
  }

  // -------------------------
  // INVENTARIO
  // -------------------------
  registerMaterialMovement(input: {
    materialId: string
    type: 'in' | 'out' | 'adjustment' | 'waste'
    quantity: number
    reason: string
    appointmentId?: string
  }) {
    const mat = this.materials.find((m) => m.id === input.materialId)
    if (!mat) throw new Error('Material no encontrado')

    const current = Number(mat.currentStock)
    let updated = current

    if (input.type === 'in') updated += input.quantity
    else if (input.type === 'out' || input.type === 'waste') updated -= input.quantity
    else if (input.type === 'adjustment') updated = input.quantity

    mat.currentStock = Math.max(0, updated).toFixed(2)

    const movement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      materialId: input.materialId,
      materialName: mat.name,
      type: input.type,
      quantity: input.quantity,
      newStock: mat.currentStock,
      reason: input.reason,
      appointmentId: input.appointmentId || null,
      createdAt: new Date().toISOString(),
    }

    this.inventoryMovements.unshift(movement)
    return { material: mat, movement }
  }
}

// Singleton global para mantener persistencia entre server actions y llamadas durante el runtime
declare global {
  var __salonRepositoryInstance: SalonRepository | undefined
}

export const salonRepo: SalonRepository = globalThis.__salonRepositoryInstance ?? new SalonRepository()
if (process.env.NODE_ENV !== 'production') {
  globalThis.__salonRepositoryInstance = salonRepo
}
