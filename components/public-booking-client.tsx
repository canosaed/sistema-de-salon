'use client'

import React, { useState, useTransition } from 'react'
import {
  CalendarDays,
  Clock,
  Sparkles,
  User,
  Phone,
  Mail,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  Calendar,
  Check,
} from 'lucide-react'
import { checkPublicAvailability, createPublicBooking } from '@/app/actions/booking'
import { getSalonDateString } from '@/lib/salon-time'

interface PublicBookingProps {
  initialCatalog: {
    categories: any[]
    services: any[]
    techniques: any[]
    professionals: any[]
    settings: any
  }
}

// Helper formatting functions
function getLocalDateString(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function PublicBookingClient({ initialCatalog }: PublicBookingProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1: Servicio, 2: Profesional y Fecha, 3: Datos, 4: Confirmado

  // Selección
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCatalog.categories[0]?.id || '')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string>('')
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('any')

  // Fecha y slots
  const todayStr = getSalonDateString()
  const today = parseLocalDate(todayStr)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => parseLocalDate(todayStr))
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; availableProfessionalIds: string[] }>>([])
  const [availabilityDetails, setAvailabilityDetails] = useState<any>(null)

  // Datos del cliente
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientNotes, setClientNotes] = useState('')
  const [acceptPolicies, setAcceptPolicies] = useState(false)

  // Estados de carga y error
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null)

  // Filtros de servicios por categoría seleccionada
  const filteredServices = initialCatalog.services.filter(
    (s) => !selectedCategory || s.categoryId === selectedCategory
  )

  const activeService = initialCatalog.services.find((s) => s.id === selectedServiceId)
  const availableTechniques = initialCatalog.techniques.filter((t) => t.serviceId === selectedServiceId)
  const activeTechnique = availableTechniques.find((t) => t.id === selectedTechniqueId)

  // Consultar disponibilidad al cambiar fecha, profesional o servicio
  const fetchAvailability = (dateStr: string, proId: string, srvId: string, techId?: string) => {
    if (!srvId || !dateStr) return
    setErrorMsg('')
    startTransition(async () => {
      try {
        const res = await checkPublicAvailability({
          serviceId: srvId,
          techniqueId: techId,
          professionalId: proId,
          dateStr,
        })
        setAvailableSlots(res.slots || [])
        setAvailabilityDetails(res)
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al consultar disponibilidad.')
      }
    })
  }

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    setSelectedTechniqueId('')
    setSelectedTime('')
    setStep(2)
    fetchAvailability(selectedDate, selectedProfessionalId, serviceId)
  }

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setSelectedTime('')
    fetchAvailability(newDate, selectedProfessionalId, selectedServiceId, selectedTechniqueId)
  }

  const handleProChange = (proId: string) => {
    setSelectedProfessionalId(proId)
    setSelectedTime('')
    fetchAvailability(selectedDate, proId, selectedServiceId, selectedTechniqueId)
  }

  const handleTechniqueChange = (techId: string) => {
    setSelectedTechniqueId(techId)
    setSelectedTime('')
    fetchAvailability(selectedDate, selectedProfessionalId, selectedServiceId, techId)
  }

  const handleConfirmReservation = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending) return
    setErrorMsg('')

    const name = clientName.trim()
    const phone = clientPhone.trim()

    if (!name || !phone) {
      setErrorMsg('Por favor ingresá tu nombre y número de teléfono.')
      return
    }

    const digits = phone.replace(/\D/g, '')
    if (digits.length < 6) {
      setErrorMsg('Por favor ingresá un teléfono o WhatsApp de contacto válido.')
      return
    }

    if (clientEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(clientEmail.trim())) {
        setErrorMsg('El formato del correo electrónico no es válido.')
        return
      }
    }

    if (!acceptPolicies) {
      setErrorMsg('Debes aceptar las políticas de reserva y cancelación para confirmar tu turno.')
      return
    }

    if (!selectedTime) {
      setErrorMsg('Por favor seleccioná un horario disponible.')
      return
    }

    startTransition(async () => {
      try {
        const res = await createPublicBooking({
          serviceId: selectedServiceId,
          techniqueId: selectedTechniqueId || undefined,
          professionalId: selectedProfessionalId === 'any' ? undefined : selectedProfessionalId,
          date: selectedDate,
          time: selectedTime,
          clientName: name,
          clientPhone: phone,
          clientEmail: clientEmail.trim() || undefined,
          notes: clientNotes.trim() || undefined,
        })
        setConfirmedBooking(res.appointment)
        setStep(4)
      } catch (err: any) {
        setErrorMsg(err.message || 'No se pudo completar la reserva. El horario pudo haber sido ocupado.')
      }
    })
  }

  // Precios y señas calculadas
  const basePrice = Number(activeService?.price || 0)
  const additionalPrice = Number(activeTechnique?.additionalPrice || 0)
  const totalPrice = basePrice + additionalPrice
  const depositAmount = availabilityDetails?.depositAmount || Math.round(totalPrice * 0.3)
  const balancePending = Math.max(0, totalPrice - depositAmount)

  // Generador del calendario para el Datepicker
  const viewYear = calendarViewDate.getFullYear()
  const viewMonth = calendarViewDate.getMonth()

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0)

  // En JavaScript getDay(): 0 es Domingo, 1 es Lunes ... 6 es Sábado
  // Para que empiece en Lunes (0 = Lun, 6 = Dom):
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = lastDayOfMonth.getDate()

  const calendarDays: Array<{ dateStr: string; dayNumber: number; isCurrentMonth: boolean; isPast: boolean; isToday: boolean }> = []

  // Días del mes anterior para relleno
  const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const prevDate = new Date(viewYear, viewMonth - 1, d)
    const dStr = getLocalDateString(prevDate)
    calendarDays.push({
      dateStr: dStr,
      dayNumber: d,
      isCurrentMonth: false,
      isPast: dStr < todayStr,
      isToday: dStr === todayStr,
    })
  }

  // Días del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(viewYear, viewMonth, d)
    const dStr = getLocalDateString(curDate)
    calendarDays.push({
      dateStr: dStr,
      dayNumber: d,
      isCurrentMonth: true,
      isPast: dStr < todayStr,
      isToday: dStr === todayStr,
    })
  }

  // Relleno final para completar semanas (múltiplo de 7)
  const remainingCells = (7 - (calendarDays.length % 7)) % 7
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(viewYear, viewMonth + 1, d)
    const dStr = getLocalDateString(nextDate)
    calendarDays.push({
      dateStr: dStr,
      dayNumber: d,
      isCurrentMonth: false,
      isPast: dStr < todayStr,
      isToday: dStr === todayStr,
    })
  }

  const canGoPrevMonth = () => {
    const firstOfCurrentView = new Date(viewYear, viewMonth, 1)
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    return firstOfCurrentView > firstOfThisMonth
  }

  const handlePrevMonth = () => {
    if (!canGoPrevMonth()) return
    setCalendarViewDate(new Date(viewYear, viewMonth - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(viewYear, viewMonth + 1, 1))
  }

  // Formato amigable de fecha seleccionada: ej. "Sábado 7 de Noviembre"
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return ''
    const d = parseLocalDate(dateStr)
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()]
    return `${dayName} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
  }

  return (
    <div className="public-booking-container">
      {/* Encabezado */}
      <header className="booking-header">
        <div className="header-badge">
          <Sparkles size={14} aria-hidden="true" /> Reserva Online Oficial
        </div>
        <h1>Atelier Beauty Studio</h1>
        <p>Especialistas en Manicuría, Uñas Esculpidas, Pedicuría y Pestañas</p>
      </header>

      {/* Barra de progreso */}
      <div className="booking-steps" role="navigation" aria-label="Progreso de reserva">
        <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
          <span>1</span> Servicio
        </div>
        <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
          <span>2</span> Fecha y Hora
        </div>
        <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
          <span>3</span> Tus Datos
        </div>
        <div className={`step-item ${step === 4 ? 'active' : ''}`}>
          <span>4</span> Confirmación
        </div>
      </div>

      {errorMsg && (
        <div className="booking-error-banner" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PASO 1: SELECCIÓN DE SERVICIO */}
      {step === 1 && (
        <div className="booking-step-card">
          <h2>1. Seleccioná tu tratamiento</h2>
          <div className="category-pills">
            {initialCatalog.categories.map((cat) => (
              <button
                key={cat.id}
                className={`cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="services-grid">
            {filteredServices.map((srv) => (
              <div
                key={srv.id}
                className={`service-booking-card ${selectedServiceId === srv.id ? 'selected' : ''}`}
                onClick={() => handleServiceSelect(srv.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleServiceSelect(srv.id)
                  }
                }}
              >
                <div className="service-card-header">
                  <div>
                    <span className="srv-category-tag">{initialCatalog.categories.find((c) => c.id === srv.categoryId)?.name || 'Tratamiento'}</span>
                    <h3>{srv.name}</h3>
                  </div>
                  <span className="service-price">
                    ${Number(srv.price).toLocaleString('es-AR')} <small>ARS</small>
                  </span>
                </div>
                <p className="service-desc">{srv.description}</p>
                <div className="service-card-footer">
                  <span className="service-duration">
                    <Clock size={13} aria-hidden="true" /> {srv.durationMinutes} min
                  </span>
                  <button className="btn-booking-select">Elegir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: TÉCNICA, PROFESIONAL, FECHA Y HORARIO */}
      {step === 2 && activeService && (
        <div className="booking-step-card">
          <button className="back-link" onClick={() => setStep(1)} aria-label="Cambiar servicio seleccionado">
            <ChevronLeft size={16} aria-hidden="true" /> Cambiar servicio ({activeService.name})
          </button>

          <h2>2. Elegí profesional, fecha y horario</h2>

          {/* Variantes / Técnicas si existen */}
          {availableTechniques.length > 0 && (
            <div className="form-group-box">
              <label className="section-label">Técnica o Diseño Adicional (Opcional):</label>
              <div className="technique-options" role="radiogroup" aria-label="Técnica adicional">
                <button
                  type="button"
                  className={`tech-pill ${!selectedTechniqueId ? 'active' : ''}`}
                  onClick={() => handleTechniqueChange('')}
                  role="radio"
                  aria-checked={!selectedTechniqueId}
                >
                  Estándar (Sin adicional)
                </button>
                {availableTechniques.map((tech) => (
                  <button
                    key={tech.id}
                    type="button"
                    className={`tech-pill ${selectedTechniqueId === tech.id ? 'active' : ''}`}
                    onClick={() => handleTechniqueChange(tech.id)}
                    role="radio"
                    aria-checked={selectedTechniqueId === tech.id}
                  >
                    {tech.name} (+${Number(tech.additionalPrice).toLocaleString('es-AR')})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selección de Profesional */}
          <div className="form-group-box">
            <label className="section-label">Profesional:</label>
            <div className="pro-select-grid" role="radiogroup" aria-label="Seleccionar profesional">
              <button
                type="button"
                className={`pro-card ${selectedProfessionalId === 'any' ? 'active' : ''}`}
                onClick={() => handleProChange('any')}
                role="radio"
                aria-checked={selectedProfessionalId === 'any'}
              >
                <div className="pro-avatar-mini" aria-hidden="true">★</div>
                <div className="pro-card-content">
                  <b className="pro-card-title">Cualquier profesional disponible</b>
                  <span className="pro-card-subtitle">Mayor cantidad de horarios libres</span>
                </div>
              </button>
              {initialCatalog.professionals.map((pro) => (
                <button
                  key={pro.id}
                  type="button"
                  className={`pro-card ${selectedProfessionalId === pro.id ? 'active' : ''}`}
                  onClick={() => handleProChange(pro.id)}
                  role="radio"
                  aria-checked={selectedProfessionalId === pro.id}
                >
                  <div className="pro-avatar-mini">{pro.initials || pro.name.substring(0, 2)}</div>
                  <div className="pro-card-content">
                    <b className="pro-card-title">{pro.name}</b>
                    <span className="pro-card-subtitle">{pro.specialties}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Fecha Moderno / Datepicker Interactivo */}
          <div className="form-group-box">
            <div className="section-label-row">
              <label className="section-label" id="datepicker-label">
                <Calendar size={16} aria-hidden="true" /> Fecha del turno:
              </label>
              <span className="selected-date-badge">
                {formatFriendlyDate(selectedDate)}
              </span>
            </div>

            <div className="modern-datepicker-container" aria-labelledby="datepicker-label">
              <div className="datepicker-header">
                <button
                  type="button"
                  className="datepicker-nav-btn"
                  onClick={handlePrevMonth}
                  disabled={!canGoPrevMonth()}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="datepicker-month-title">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </div>
                <button
                  type="button"
                  className="datepicker-nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="datepicker-grid">
                <div className="datepicker-weekdays">
                  {DAY_LABELS.map((label) => (
                    <span key={label} className="datepicker-weekday">{label}</span>
                  ))}
                </div>
                <div className="datepicker-days" role="grid" aria-label={`Días de ${MONTH_NAMES[viewMonth]} ${viewYear}`}>
                  {calendarDays.map((cd, idx) => {
                    const isSelected = cd.dateStr === selectedDate
                    const isClickable = !cd.isPast

                    return (
                      <button
                        key={`${cd.dateStr}-${idx}`}
                        type="button"
                        data-date={cd.dateStr}
                        disabled={!isClickable}
                        className={`datepicker-day-cell ${
                          !cd.isCurrentMonth ? 'other-month' : ''
                        } ${cd.isToday ? 'is-today' : ''} ${
                          isSelected ? 'is-selected' : ''
                        } ${cd.isPast ? 'is-disabled' : ''}`}
                        onClick={() => {
                          if (isClickable) {
                            handleDateChange(cd.dateStr)
                          }
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${cd.dayNumber} de ${MONTH_NAMES[viewMonth]}`}
                      >
                        <span className="day-number">{cd.dayNumber}</span>
                        {cd.isToday && <span className="today-dot" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Selector de Horarios Disponibles */}
          <div className="form-group-box">
            <label className="section-label">
              <Clock size={16} aria-hidden="true" /> Horarios disponibles para el {formatFriendlyDate(selectedDate)}:
            </label>
            {isPending ? (
              <div className="loading-copy-box">
                <div className="spinner-mini" aria-hidden="true" />
                <span>Consultando disponibilidad en tiempo real...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="empty-slots-box">
                <AlertCircle size={20} className="empty-slots-icon" aria-hidden="true" />
                <p>No hay turnos disponibles para esta fecha. Probá seleccionando otro día en el calendario o eligiendo «Cualquier profesional disponible».</p>
              </div>
            ) : (
              <div className="slots-grid" role="radiogroup" aria-label="Horarios disponibles">
                {availableSlots.map(({ time }) => (
                  <button
                    key={time}
                    type="button"
                    className={`slot-chip ${selectedTime === time ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(time)}
                    role="radio"
                    aria-checked={selectedTime === time}
                  >
                    {time} hs
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="step-actions">
            <button className="secondary-button" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button
              className="primary-button"
              disabled={!selectedTime || isPending}
              onClick={() => setStep(3)}
            >
              Continuar <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: DATOS DEL CLIENTE, POLÍTICAS Y SEÑAS */}
      {step === 3 && activeService && (
        <form className="booking-step-card" onSubmit={handleConfirmReservation}>
          <button type="button" className="back-link" onClick={() => setStep(2)} aria-label="Modificar fecha y horario">
            <ChevronLeft size={16} aria-hidden="true" /> Modificar horario ({selectedDate} a las {selectedTime} hs)
          </button>

          <h2>3. Completá tus datos para la reserva</h2>

          <div className="summary-banner">
            <div className="summary-banner-header">
              <Sparkles size={16} aria-hidden="true" />
              <h3>Resumen de tu turno</h3>
            </div>
            <div className="summary-banner-body">
              <div className="summary-row">
                <span className="summary-label">Tratamiento:</span>
                <span className="summary-value">
                  <strong>{activeService.name}</strong>
                  {activeTechnique ? ` (${activeTechnique.name})` : ''}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Fecha y horario:</span>
                <span className="summary-value"><strong>{formatFriendlyDate(selectedDate)}</strong> a las <strong>{selectedTime} hs</strong></span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Duración estimada:</span>
                <span className="summary-value">{availabilityDetails?.totalDurationMinutes || activeService.durationMinutes} minutos</span>
              </div>
            </div>

            <div className="pricing-breakdown">
              <div className="breakdown-row">
                <span>Precio del tratamiento:</span>
                <strong>${totalPrice.toLocaleString('es-AR')} ARS</strong>
              </div>
              <div className="breakdown-row highlight-deposit">
                <span>Seña requerida para confirmar:</span>
                <strong>${depositAmount.toLocaleString('es-AR')} ARS</strong>
              </div>
              <div className="breakdown-row">
                <span>Saldo restante a abonar en el salón:</span>
                <span>${balancePending.toLocaleString('es-AR')} ARS</span>
              </div>
            </div>
          </div>

          <div className="form-fields-container">
            <div className="inputs-grid">
              <div className="form-field-group">
                <label htmlFor="client-name" className="field-label">
                  Nombre y Apellido <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="client-name"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. Sofía Martínez"
                    className="modern-input"
                  />
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="client-phone" className="field-label">
                  Teléfono / WhatsApp <span className="required-star">*</span>
                </label>
                <div className="input-with-icon">
                  <Phone size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="client-phone"
                    required
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. 11 5555 0182"
                    className="modern-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="client-email" className="field-label">
                Correo electrónico <span className="optional-tag">(opcional, para recordatorios)</span>
              </label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" aria-hidden="true" />
                <input
                  id="client-email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="sofia@ejemplo.com"
                  className="modern-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="client-notes" className="field-label">
                Observaciones o preferencias <span className="optional-tag">(opcional)</span>
              </label>
              <div className="input-with-icon input-textarea-wrapper">
                <FileText size={16} className="input-icon textarea-icon" aria-hidden="true" />
                <textarea
                  id="client-notes"
                  rows={3}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Contanos si tenés uñas frágiles, si necesitás retiro previo o alguna preferencia de diseño..."
                  className="modern-input modern-textarea"
                />
              </div>
            </div>

            <div
              className={`modern-policy-card ${acceptPolicies ? 'is-checked' : ''}`}
              onClick={() => setAcceptPolicies(!acceptPolicies)}
              role="checkbox"
              aria-checked={acceptPolicies}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setAcceptPolicies(!acceptPolicies)
                }
              }}
            >
              <div className={`custom-checkbox-box ${acceptPolicies ? 'checked' : ''}`}>
                {acceptPolicies && <Check size={14} strokeWidth={3} />}
              </div>
              <div className="policy-text">
                <b>Políticas de reserva y cancelación:</b>
                <span>
                  Para asegurar tu turno solicitamos una seña previa. En caso de no poder asistir, podés reprogramar o cancelar con al menos 24 horas de anticipación sin perder tu seña.
                </span>
              </div>
            </div>
          </div>

          <div className="step-actions">
            <button type="button" className="secondary-button" onClick={() => setStep(2)}>
              Atrás
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isPending || !acceptPolicies || !clientName || !clientPhone}
            >
              {isPending ? 'Confirmando...' : 'Confirmar Reserva'}
            </button>
          </div>
        </form>
      )}

      {/* PASO 4: CONFIRMACIÓN EXITOSA */}
      {step === 4 && confirmedBooking && (
        <div className="booking-step-card confirmation-card">
          <div className="confirmation-icon">
            <CheckCircle2 size={48} color="#2e7d32" />
          </div>
          <h2>¡Tu turno fue reservado con éxito!</h2>
          <p className="confirmation-subtitle">
            Te esperamos en Atelier Beauty Studio el <b>{confirmedBooking.date}</b> a las <b>{confirmedBooking.time} hs</b>.
          </p>

          <div className="confirmation-details">
            <div><span>Cliente:</span> <b>{confirmedBooking.clientName}</b></div>
            <div><span>Tratamiento:</span> <b>{confirmedBooking.serviceName}</b></div>
            <div><span>Profesional:</span> <b>{confirmedBooking.professional}</b></div>
            <div><span>Duración estimada:</span> <b>{confirmedBooking.totalDurationMinutes} min</b></div>
            <div><span>Total:</span> <b>${Number(confirmedBooking.totalPrice).toLocaleString('es-AR')} ARS</b></div>
            <div><span>Seña a abonar:</span> <b>${Number(confirmedBooking.requiredDeposit).toLocaleString('es-AR')} ARS</b></div>
            <div><span>Estado:</span> <span className="status-badge">{confirmedBooking.status === 'confirmed' ? 'Confirmado' : 'Pendiente de confirmación'}</span></div>
          </div>

          <div className="payment-instructions">
            <h4><ShieldCheck size={18} /> Datos para abonar la seña</h4>
            <p>Alias de transferencia: <strong>ATELIER.BEAUTY.MP</strong></p>
            <p>Titular: Atelier Beauty Studio S.R.L.</p>
            <p>Una vez realizada la transferencia, enviá tu comprobante por WhatsApp al 11 5555 0000.</p>
          </div>

          <button
            className="primary-button"
            style={{ marginTop: '1.5rem' }}
            onClick={() => {
              setStep(1)
              setSelectedServiceId('')
              setSelectedTechniqueId('')
              setSelectedTime('')
              setConfirmedBooking(null)
            }}
          >
            Realizar otra reserva
          </button>
        </div>
      )}
    </div>
  )
}
