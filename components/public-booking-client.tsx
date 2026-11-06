'use client'

import { useState, useTransition } from 'react'
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
  Scissors,
} from 'lucide-react'
import { checkPublicAvailability, createPublicBooking } from '@/app/actions/booking'

interface PublicBookingProps {
  initialCatalog: {
    categories: any[]
    services: any[]
    techniques: any[]
    professionals: any[]
    settings: any
  }
}

export default function PublicBookingClient({ initialCatalog }: PublicBookingProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1: Servicio, 2: Profesional y Fecha, 3: Datos, 4: Confirmado

  // Selección
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCatalog.categories[0]?.id || '')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string>('')
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('any')

  // Fecha y slots
  const todayStr = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
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
        setAvailableSlots(res.slots)
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
    setErrorMsg('')

    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMsg('Por favor ingresá tu nombre y número de teléfono.')
      return
    }

    if (!acceptPolicies) {
      setErrorMsg('Debes aceptar las políticas de reserva y cancelación.')
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
          clientName,
          clientPhone,
          clientEmail,
          notes: clientNotes,
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

  return (
    <div className="public-booking-container">
      {/* Encabezado */}
      <header className="booking-header">
        <div className="header-badge">
          <Sparkles size={14} /> Reserva Online Oficial
        </div>
        <h1>Atelier Beauty Studio</h1>
        <p>Especialistas en Manicuría, Uñas Esculpidas, Pedicuría y Pestañas</p>
      </header>

      {/* Barra de progreso */}
      <div className="booking-steps">
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
          <AlertCircle size={18} />
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
              >
                <div className="service-card-header">
                  <div className="service-icon-wrap">
                    <Scissors size={20} />
                  </div>
                  <div>
                    <h3>{srv.name}</h3>
                    <span className="service-duration">
                      <Clock size={14} /> {srv.durationMinutes} min
                    </span>
                  </div>
                </div>
                <p className="service-desc">{srv.description}</p>
                <div className="service-card-footer">
                  <span className="service-price">
                    ${Number(srv.price).toLocaleString('es-AR')} ARS
                  </span>
                  <button className="primary-button-sm">Elegir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: TÉCNICA, PROFESIONAL, FECHA Y HORARIO */}
      {step === 2 && activeService && (
        <div className="booking-step-card">
          <button className="back-link" onClick={() => setStep(1)}>
            <ChevronLeft size={16} /> Cambiar servicio ({activeService.name})
          </button>

          <h2>2. Elegí profesional, fecha y horario</h2>

          {/* Variantes / Técnicas si existen */}
          {availableTechniques.length > 0 && (
            <div className="form-group-box">
              <label className="section-label">Técnica o Diseño Adicional (Opcional):</label>
              <div className="technique-options">
                <button
                  type="button"
                  className={`tech-pill ${!selectedTechniqueId ? 'active' : ''}`}
                  onClick={() => handleTechniqueChange('')}
                >
                  Estándar (Sin adicional)
                </button>
                {availableTechniques.map((tech) => (
                  <button
                    key={tech.id}
                    type="button"
                    className={`tech-pill ${selectedTechniqueId === tech.id ? 'active' : ''}`}
                    onClick={() => handleTechniqueChange(tech.id)}
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
            <div className="pro-select-grid">
              <button
                type="button"
                className={`pro-card ${selectedProfessionalId === 'any' ? 'active' : ''}`}
                onClick={() => handleProChange('any')}
              >
                <b>Cualquier profesional disponible</b>
                <span>Mayor cantidad de horarios libres</span>
              </button>
              {initialCatalog.professionals.map((pro) => (
                <button
                  key={pro.id}
                  type="button"
                  className={`pro-card ${selectedProfessionalId === pro.id ? 'active' : ''}`}
                  onClick={() => handleProChange(pro.id)}
                >
                  <div className="pro-avatar-mini">{pro.initials || pro.name.substring(0, 2)}</div>
                  <div>
                    <b>{pro.name}</b>
                    <span>{pro.specialties}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Fecha */}
          <div className="form-group-box">
            <label className="section-label">Fecha del turno:</label>
            <input
              type="date"
              className="date-picker-input"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          {/* Selector de Horarios Disponibles */}
          <div className="form-group-box">
            <label className="section-label">Horarios disponibles en {selectedDate}:</label>
            {isPending ? (
              <p className="loading-copy">Consultando disponibilidad en tiempo real...</p>
            ) : availableSlots.length === 0 ? (
              <p className="empty-copy">No hay turnos disponibles para esta fecha. Probá con otro día o con cualquier profesional.</p>
            ) : (
              <div className="slots-grid">
                {availableSlots.map(({ time }) => (
                  <button
                    key={time}
                    type="button"
                    className={`slot-chip ${selectedTime === time ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(time)}
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
              Continuar <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: DATOS DEL CLIENTE, POLÍTICAS Y SEÑAS */}
      {step === 3 && activeService && (
        <form className="booking-step-card" onSubmit={handleConfirmReservation}>
          <button type="button" className="back-link" onClick={() => setStep(2)}>
            <ChevronLeft size={16} /> Modificar horario ({selectedDate} a las {selectedTime} hs)
          </button>

          <h2>3. Completá tus datos para la reserva</h2>

          <div className="summary-banner">
            <h3>Resumen de la reserva</h3>
            <p><strong>Servicio:</strong> {activeService.name} {activeTechnique ? `+ ${activeTechnique.name}` : ''}</p>
            <p><strong>Día y Hora:</strong> {selectedDate} a las {selectedTime} hs</p>
            <p><strong>Duración total:</strong> {availabilityDetails?.totalDurationMinutes || activeService.durationMinutes} min</p>
            <div className="pricing-breakdown">
              <div><span>Precio total:</span> <strong>${totalPrice.toLocaleString('es-AR')} ARS</strong></div>
              <div><span>Seña requerida para confirmar:</span> <strong>${depositAmount.toLocaleString('es-AR')} ARS</strong></div>
              <div><span>Saldo a abonar en el salón:</span> <strong>${balancePending.toLocaleString('es-AR')} ARS</strong></div>
            </div>
          </div>

          <div className="inputs-grid">
            <label>
              Nombre y Apellido *
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Sofía Martínez"
              />
            </label>
            <label>
              Teléfono / WhatsApp *
              <input
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Ej. 11 5555 0182"
              />
            </label>
          </div>

          <label>
            Correo electrónico (opcional, para recordatorios)
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </label>

          <label>
            Observaciones o preferencias
            <textarea
              rows={2}
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Ej. Uñas sensibles, preferencia de color, etc."
            />
          </label>

          <div className="policy-checkbox">
            <input
              type="checkbox"
              id="policies"
              checked={acceptPolicies}
              onChange={(e) => setAcceptPolicies(e.target.checked)}
            />
            <label htmlFor="policies">
              Acepto las políticas de cancelación del salón: avisar con al menos 24 horas de anticipación para conservar o reprogramar la seña.
            </label>
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
