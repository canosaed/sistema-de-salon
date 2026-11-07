export const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export const DAY_NAMES_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export type AgendaViewMode = 'day' | 'week' | 'month'

export interface AgendaPeriodRange {
  startDate: string
  endDate: string
  label: string
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getAgendaPeriodRange(anchorDateStr: string, view: AgendaViewMode): AgendaPeriodRange {
  const anchor = parseLocalDate(anchorDateStr)

  if (view === 'day') {
    return {
      startDate: anchorDateStr,
      endDate: anchorDateStr,
      label: `${DAY_NAMES_ES[anchor.getDay()]} ${anchor.getDate()} de ${MONTH_NAMES_ES[anchor.getMonth()]} ${anchor.getFullYear()}`,
    }
  }

  if (view === 'week') {
    const dayOfWeek = (anchor.getDay() + 6) % 7 // 0 = Lunes, 6 = Domingo
    const start = new Date(anchor)
    start.setDate(anchor.getDate() - dayOfWeek)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const startStr = formatLocalDate(start)
    const endStr = formatLocalDate(end)

    const label =
      start.getMonth() === end.getMonth()
        ? `Semana del ${start.getDate()} al ${end.getDate()} de ${MONTH_NAMES_ES[start.getMonth()]} ${start.getFullYear()}`
        : `Semana del ${start.getDate()} de ${MONTH_NAMES_ES[start.getMonth()]} al ${end.getDate()} de ${MONTH_NAMES_ES[end.getMonth()]} ${start.getFullYear()}`

    return {
      startDate: startStr,
      endDate: endStr,
      label,
    }
  }

  // month
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
    label: `${MONTH_NAMES_ES[anchor.getMonth()]} ${anchor.getFullYear()}`,
  }
}

export function shiftAgendaDate(anchorDateStr: string, view: AgendaViewMode, offset: number): string {
  const anchor = parseLocalDate(anchorDateStr)

  if (view === 'day') {
    anchor.setDate(anchor.getDate() + offset)
    return formatLocalDate(anchor)
  }

  if (view === 'week') {
    anchor.setDate(anchor.getDate() + offset * 7)
    return formatLocalDate(anchor)
  }

  // month
  anchor.setMonth(anchor.getMonth() + offset)
  return formatLocalDate(anchor)
}

export function isAppointmentInPeriod(appointmentDate: string, range: AgendaPeriodRange): boolean {
  return appointmentDate >= range.startDate && appointmentDate <= range.endDate
}
