/**
 * Lógica pura de reglas de negocio para disponibilidad de turnos, duraciones y pagos.
 * Diseñado según las especificaciones del salón Atelier Beauty Studio.
 */

export interface ServiceItemInput {
  serviceId: string
  name: string
  durationMinutes: number
  prepMinutes?: number
  cleanupMinutes?: number
  price: number
  techniqueId?: string
  techniqueName?: string
  additionalPrice?: number
  additionalMinutes?: number
}

export interface WorkingSchedule {
  dayOfWeek: number // 0 = Domingo, 1 = Lunes, etc.
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  breakStartTime?: string | null
  breakEndTime?: string | null
  isActive: boolean
}

export interface TimeInterval {
  startMinutes: number // minutos desde las 00:00
  endMinutes: number
}

export interface BookedAppointmentSlot {
  startMinutes: number
  endMinutes: number
  status: string // 'pending_confirmation', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
}

export interface AbsenceSlot {
  startDate: string // "YYYY-MM-DD"
  endDate: string // "YYYY-MM-DD"
}

export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * 5.2. Duración de los turnos y precios contratados
 * Cuando se seleccionan varios servicios, se ejecutan secuencialmente:
 * - Se calcula duración individual
 * - Se calculan tiempos de preparación y limpieza
 * - Se determina la duración total
 * - Se calcula precio total
 */
export function calculateAppointmentTotals(services: ServiceItemInput[]) {
  let netDuration = 0
  let totalPrep = 0
  let totalCleanup = 0
  let totalPrice = 0

  for (const s of services) {
    const techMinutes = s.additionalMinutes || 0
    const techPrice = s.additionalPrice || 0
    netDuration += s.durationMinutes + techMinutes
    totalPrep += s.prepMinutes || 0
    totalCleanup += s.cleanupMinutes || 0
    totalPrice += s.price + techPrice
  }

  // La duración total de ocupación de la profesional incluye preparación y limpieza
  const totalOccupiedDurationMinutes = totalPrep + netDuration + totalCleanup

  return {
    netDurationMinutes: netDuration,
    totalPrepMinutes: totalPrep,
    totalCleanupMinutes: totalCleanup,
    totalOccupiedDurationMinutes,
    totalPrice,
  }
}

/**
 * 4.8. Pagos, señas y saldos
 * Saldo = Precio total - Pagos registrados
 */
export function calculatePaymentBalance(
  totalPrice: number,
  registeredPayments: Array<{ amount: number; type: 'deposit' | 'partial' | 'full' | 'refund' }>
) {
  let totalPaid = 0

  for (const p of registeredPayments) {
    if (p.type === 'refund') {
      totalPaid -= p.amount
    } else {
      totalPaid += p.amount
    }
  }

  const balance = Math.max(0, totalPrice - totalPaid)

  let paymentStatus: 'pending' | 'deposit_paid' | 'partially_paid' | 'paid' | 'refunded' = 'pending'

  if (totalPaid <= 0 && registeredPayments.some((p) => p.type === 'refund')) {
    paymentStatus = 'refunded'
  } else if (totalPaid >= totalPrice && totalPrice > 0) {
    paymentStatus = 'paid'
  } else if (totalPaid > 0 && totalPaid < totalPrice) {
    // Si tiene al menos una seña registrada
    const hasDeposit = registeredPayments.some((p) => p.type === 'deposit')
    paymentStatus = hasDeposit ? 'deposit_paid' : 'partially_paid'
  } else if (totalPaid <= 0) {
    paymentStatus = 'pending'
  }

  return {
    totalPrice,
    totalPaid,
    balancePending: balance,
    paymentStatus,
  }
}

/**
 * 5.1. Reglas de Disponibilidad:
 * 1. No permitir superposición de turnos para una misma profesional.
 * 2. Verificar horarios laborales.
 * 3. Verificar descansos.
 * 4. Verificar ausencias.
 * 5. Considerar duración completa (incluyendo preparación y limpieza).
 * 6. Intervalo de disponibilidad (slotStepMinutes, p.ej. 30 min).
 */
export function calculateAvailableSlots(params: {
  dateStr: string // "YYYY-MM-DD"
  schedule: WorkingSchedule | null
  existingAppointments: BookedAppointmentSlot[]
  absences?: AbsenceSlot[]
  blocks?: TimeInterval[]
  totalDurationMinutes: number
  slotStepMinutes?: number // Por defecto cada 30 minutos
}): string[] {
  const {
    dateStr,
    schedule,
    existingAppointments,
    absences = [],
    blocks = [],
    totalDurationMinutes,
    slotStepMinutes = 30,
  } = params

  if (!schedule || !schedule.isActive) {
    return []
  }

  // 1. Verificar si la profesional está ausente en la fecha
  for (const absence of absences) {
    if (dateStr >= absence.startDate && dateStr <= absence.endDate) {
      return [] // En ausencia / vacaciones
    }
  }

  const workStart = parseTimeToMinutes(schedule.startTime)
  const workEnd = parseTimeToMinutes(schedule.endTime)

  let breakStart = -1
  let breakEnd = -1
  if (schedule.breakStartTime && schedule.breakEndTime) {
    breakStart = parseTimeToMinutes(schedule.breakStartTime)
    breakEnd = parseTimeToMinutes(schedule.breakEndTime)
  }

  // Filtrar citas que ocupen tiempo (las canceladas liberan el horario)
  const activeBookings = existingAppointments.filter((a) => a.status !== 'cancelled')

  const availableSlotTimes: string[] = []

  // Iterar posibles inicios de turnos
  for (let slotStart = workStart; slotStart + totalDurationMinutes <= workEnd; slotStart += slotStepMinutes) {
    const slotEnd = slotStart + totalDurationMinutes

    // Verificar si colisiona con el descanso
    if (breakStart !== -1 && breakEnd !== -1) {
      const overlapsBreak = Math.max(slotStart, breakStart) < Math.min(slotEnd, breakEnd)
      if (overlapsBreak) {
        continue
      }
    }

    // Verificar si colisiona con algún bloqueo manual
    let overlapsBlock = false
    for (const b of blocks) {
      if (Math.max(slotStart, b.startMinutes) < Math.min(slotEnd, b.endMinutes)) {
        overlapsBlock = true
        break
      }
    }
    if (overlapsBlock) continue

    // Verificar colisión con otros turnos existentes de la profesional
    let overlapsBooking = false
    for (const b of activeBookings) {
      if (Math.max(slotStart, b.startMinutes) < Math.min(slotEnd, b.endMinutes)) {
        overlapsBooking = true
        break
      }
    }
    if (overlapsBooking) continue

    availableSlotTimes.push(minutesToTimeString(slotStart))
  }

  return availableSlotTimes
}

/**
 * 5.1 / 4.3. Validación definitiva de no superposición para inserción o reprogramación
 */
export function checkSlotCollision(
  newSlot: { startMinutes: number; endMinutes: number; appointmentId?: string },
  existingSlots: Array<{ id?: string; startMinutes: number; endMinutes: number; status: string }>
): boolean {
  for (const existing of existingSlots) {
    if (existing.status === 'cancelled') continue
    if (newSlot.appointmentId && existing.id === newSlot.appointmentId) continue // no chocar consigo mismo al reprogramar

    const overlap = Math.max(newSlot.startMinutes, existing.startMinutes) < Math.min(newSlot.endMinutes, existing.endMinutes)
    if (overlap) {
      return true // hay colisión
    }
  }
  return false
}
