'use client'

import { useState, useTransition, useMemo } from 'react'
import {
  CalendarDays,
  Clock3,
  Users,
  DollarSign,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  Scissors,
  X,
  Calendar,
  Layers,
  Sparkles,
  LogOut,
  Package,
  TrendingUp,
  Settings,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Ban,
  Wifi,
  WifiOff,
  Filter,
} from 'lucide-react'
import {
  createInternalAppointment,
  updateAppointmentStatusAction,
  rescheduleAppointmentAction,
  registerAppointmentPaymentAction,
  recordMaterialConsumptionAction,
} from '@/app/actions/dashboard'
import { createClient, updateClient, deleteClient } from '@/app/actions/clients'
import { createService, updateService, deleteService } from '@/app/actions/services'
import { createProfessional, updateProfessional, deleteProfessional } from '@/app/actions/professionals'
import { createMaterialAction, updateMaterialAction, deleteMaterialAction } from '@/app/actions/inventory'
import { updateSalonSettingsAction } from '@/app/actions/settings'

interface DashboardProps {
  initialData: {
    categories: any[]
    services: any[]
    techniques: any[]
    materials: any[]
    professionals: any[]
    clients: any[]
    appointments: any[]
    payments: any[]
    inventoryMovements: any[]
    settings: any
  }
}

export default function DashboardClient({ initialData }: DashboardProps) {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<
    'Resumen' | 'Agenda' | 'Reservas' | 'Clientes' | 'Servicios' | 'Profesionales' | 'Pagos' | 'Inventario' | 'Reportes' | 'Configuración'
  >('Resumen')

  // Estado local sincronizado
  const [appointments, setAppointments] = useState<any[]>(initialData.appointments)
  const [clients, setClients] = useState<any[]>(initialData.clients)
  const [services, setServices] = useState<any[]>(initialData.services)
  const [professionals, setProfessionals] = useState<any[]>(initialData.professionals)
  const [materials, setMaterials] = useState<any[]>(initialData.materials)
  const [payments, setPayments] = useState<any[]>(initialData.payments)
  const [inventoryMovements, setInventoryMovements] = useState<any[]>(initialData.inventoryMovements)
  const [settings, setSettings] = useState<any>(initialData.settings)
  const [isOnline, setIsOnline] = useState(true)

  // Filtros de Agenda
  const [agendaView, setAgendaView] = useState<'day' | 'week' | 'month'>('week')
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')

  // Búsqueda de Clientes
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [selectedClientDetail, setSelectedClientDetail] = useState<any>(null)

  // Modales
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null) // appointment seleccionado
  const [showRescheduleModal, setShowRescheduleModal] = useState<any>(null)
  const [showCancelModal, setShowCancelModal] = useState<any>(null)
  const [showInventoryModal, setShowInventoryModal] = useState(false)
  const [showMaterialModal, setShowMaterialModal] = useState<any>(null) // null = cerrado, 'new' = alta, objeto = edición
  const [showServiceModal, setShowServiceModal] = useState<any>(null) // null = cerrado, 'new' = alta, objeto = edición
  const [showProfessionalModal, setShowProfessionalModal] = useState<any>(null) // null = cerrado, 'new' = alta, objeto = edición

  // Formularios
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState('')

  // Formulario ABM Material
  const [materialForm, setMaterialForm] = useState({
    id: '',
    name: '',
    category: 'Manicuría',
    unit: 'unidades',
    currentStock: '10',
    minimumStock: '3',
    estimatedCostUnit: '0',
  })

  // Formulario Configuración
  const [settingsForm, setSettingsForm] = useState({
    salonName: initialData.settings?.salonName || 'Atelier Beauty Studio',
    currency: initialData.settings?.currency || 'ARS',
    defaultDepositPercentage: initialData.settings?.defaultDepositPercentage || 30,
    minCancelHoursNotice: initialData.settings?.minCancelHoursNotice || 24,
    autoConfirmPublicBookings: initialData.settings?.autoConfirmPublicBookings ?? false,
    allowSimultaneousServices: initialData.settings?.allowSimultaneousServices ?? false,
    cancellationPolicyText: initialData.settings?.cancellationPolicyText || 'Cancelaciones con al menos 24 hs de anticipación.',
    businessHoursStart: initialData.settings?.businessHoursStart || '09:00',
    businessHoursEnd: initialData.settings?.businessHoursEnd || '20:00',
  })

  // Formulario ABM Servicio
  const [serviceForm, setServiceForm] = useState({
    id: '',
    categoryId: initialData.categories[0]?.id || 'cat-manos',
    name: '',
    description: '',
    price: '18500',
    durationMinutes: 60,
    prepMinutes: 5,
    cleanupMinutes: 10,
    depositType: 'percentage' as 'fixed' | 'percentage',
    depositValue: 30,
    allowPublicBooking: true,
  })

  // Formulario ABM Profesional
  const [proForm, setProForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    specialties: '',
    initials: '',
  })

  // Formulario Nuevo Turno Interno
  const [formClientMode, setFormClientMode] = useState<'existing' | 'new'>('existing')
  const [formClientId, setFormClientId] = useState('')
  const [formClientName, setFormClientName] = useState('')
  const [formClientPhone, setFormClientPhone] = useState('')
  const [formServiceId, setFormServiceId] = useState(initialData.services[0]?.id || '')
  const [formTechniqueId, setFormTechniqueId] = useState('')
  const [formProId, setFormProId] = useState(initialData.professionals[0]?.id || '')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formTime, setFormTime] = useState('11:00')
  const [formNotes, setFormNotes] = useState('')
  const [formDepositAmount, setFormDepositAmount] = useState('0')
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')

  // Formulario Cliente
  const [clientForm, setClientForm] = useState({ id: '', name: '', phone: '', email: '', notes: '' })

  // Formulario Pago
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'deposit' | 'partial' | 'full' | 'refund'>('partial')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')

  // Formulario Reprogramación
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0])
  const [rescheduleTime, setRescheduleTime] = useState('14:00')

  // Formulario Cancelación
  const [cancellationReason, setCancellationReason] = useState('Solicitado por el cliente')

  // Formulario Inventario
  const [invMaterialId, setInvMaterialId] = useState(initialData.materials[0]?.id || '')
  const [invType, setInvType] = useState<'in' | 'out' | 'adjustment' | 'waste'>('out')
  const [invQuantity, setInvQuantity] = useState('1')
  const [invReason, setInvReason] = useState('Consumo en servicio')

  // --------------------------------------------------------------------------
  // CÁLCULOS Y ESTADÍSTICAS DEL DASHBOARD
  // --------------------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0]
  const todayAppointments = appointments.filter((a) => a.date === todayStr && a.status !== 'cancelled')
  const pendingAppointments = appointments.filter((a) => a.status === 'pending_confirmation')
  const totalMonthRevenue = payments
    .filter((p) => p.type !== 'refund')
    .reduce((acc, curr) => acc + Number(curr.amount), 0)

  // Filtrado de turnos para la Agenda
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (selectedProfessionalFilter !== 'all' && a.professionalId !== selectedProfessionalFilter) return false
      if (selectedStatusFilter !== 'all' && a.status !== selectedStatusFilter) return false
      return true
    })
  }, [appointments, selectedProfessionalFilter, selectedStatusFilter])

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateInternalAppointment = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    startTransition(async () => {
      try {
        const clientName = formClientMode === 'existing'
          ? clients.find((c) => c.id === formClientId)?.name || ''
          : formClientName
        const clientPhone = formClientMode === 'existing'
          ? clients.find((c) => c.id === formClientId)?.phone || ''
          : formClientPhone

        if (!clientName || !clientPhone) {
          setFormError('Por favor seleccione o ingrese un cliente con teléfono válido.')
          return
        }

        const apt = await createInternalAppointment({
          clientId: formClientMode === 'existing' ? formClientId : undefined,
          clientName,
          clientPhone,
          serviceIds: [formServiceId],
          techniqueIds: formTechniqueId ? [formTechniqueId] : [],
          professionalId: formProId,
          date: formDate,
          time: formTime,
          notes: formNotes,
          initialDepositAmount: Number(formDepositAmount) || 0,
          paymentMethod: formPaymentMethod,
        })

        setAppointments((prev) => [apt, ...prev])
        setShowNewAppointmentModal(false)
        setFormNotes('')
        setFormDepositAmount('0')
      } catch (err: any) {
        setFormError(err.message || 'Error al agendar el turno.')
      }
    })
  }

  // ABM SERVICIOS
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        if (serviceForm.id) {
          const updated = await updateService(serviceForm.id, {
            categoryId: serviceForm.categoryId,
            name: serviceForm.name,
            description: serviceForm.description,
            price: Number(serviceForm.price),
            durationMinutes: Number(serviceForm.durationMinutes),
            prepMinutes: Number(serviceForm.prepMinutes),
            cleanupMinutes: Number(serviceForm.cleanupMinutes),
            depositType: serviceForm.depositType,
            depositValue: Number(serviceForm.depositValue),
            allowPublicBooking: serviceForm.allowPublicBooking,
          })
          setServices((prev) => prev.map((s) => (s.id === serviceForm.id ? updated : s)))
        } else {
          const created = await createService({
            categoryId: serviceForm.categoryId,
            name: serviceForm.name,
            description: serviceForm.description,
            price: Number(serviceForm.price),
            durationMinutes: Number(serviceForm.durationMinutes),
            prepMinutes: Number(serviceForm.prepMinutes),
            cleanupMinutes: Number(serviceForm.cleanupMinutes),
            depositType: serviceForm.depositType,
            depositValue: Number(serviceForm.depositValue),
            allowPublicBooking: serviceForm.allowPublicBooking,
          })
          setServices((prev) => [created, ...prev])
        }
        setShowServiceModal(null)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleDeleteService = (id: string, name: string) => {
    if (!confirm(`¿Eliminar el servicio "${name}"?`)) return
    startTransition(async () => {
      try {
        await deleteService(id)
        setServices((prev) => prev.filter((s) => s.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  // ABM PROFESIONALES
  const handleSaveProfessional = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        if (proForm.id) {
          const updated = await updateProfessional(proForm.id, {
            name: proForm.name,
            phone: proForm.phone,
            email: proForm.email,
            specialties: proForm.specialties,
            initials: proForm.initials,
          })
          setProfessionals((prev) => prev.map((p) => (p.id === proForm.id ? updated : p)))
        } else {
          const created = await createProfessional({
            name: proForm.name,
            phone: proForm.phone,
            email: proForm.email,
            specialties: proForm.specialties,
            initials: proForm.initials,
          })
          setProfessionals((prev) => [...prev, created])
        }
        setShowProfessionalModal(null)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleDeleteProfessional = (id: string, name: string) => {
    if (!confirm(`¿Desactivar a la profesional "${name}"? Se conservará todo su historial.`)) return
    startTransition(async () => {
      try {
        await deleteProfessional(id)
        setProfessionals((prev) => prev.filter((p) => p.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleStatusChange = (appointmentId: string, status: any) => {
    startTransition(async () => {
      try {
        const updated = await updateAppointmentStatusAction(appointmentId, status)
        setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, status: updated.status } : a)))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!showCancelModal) return
    startTransition(async () => {
      try {
        const updated = await updateAppointmentStatusAction(showCancelModal.id, 'cancelled', cancellationReason)
        setAppointments((prev) => prev.map((a) => (a.id === showCancelModal.id ? { ...a, status: 'cancelled', cancellationReason } : a)))
        setShowCancelModal(null)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleConfirmReschedule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!showRescheduleModal) return
    startTransition(async () => {
      try {
        const updated = await rescheduleAppointmentAction(showRescheduleModal.id, rescheduleDate, rescheduleTime)
        setAppointments((prev) => prev.map((a) => (a.id === showRescheduleModal.id ? updated : a)))
        setShowRescheduleModal(null)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!showPaymentModal) return
    startTransition(async () => {
      try {
        const amount = Number(paymentAmount)
        if (!amount || amount <= 0) return
        const res = await registerAppointmentPaymentAction({
          appointmentId: showPaymentModal.id,
          amount,
          method: paymentMethod,
          type: paymentType,
          notes: paymentNotes,
        })
        setPayments((prev) => [res.payment, ...prev])
        setAppointments((prev) => prev.map((a) => (a.id === showPaymentModal.id ? { ...a, paymentStatus: res.balance.paymentStatus } : a)))
        setShowPaymentModal(null)
        setPaymentAmount('')
        setPaymentNotes('')
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        if (clientForm.id) {
          const updated = await updateClient({
            id: clientForm.id,
            name: clientForm.name,
            phone: clientForm.phone,
          })
          setClients((prev) => prev.map((c) => (c.id === clientForm.id ? { ...c, ...updated } : c)))
        } else {
          const created = await createClient({
            name: clientForm.name,
            phone: clientForm.phone,
          })
          setClients((prev) => [created, ...prev])
        }
        setShowClientModal(false)
        setClientForm({ id: '', name: '', phone: '', email: '', notes: '' })
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  // ABM MATERIALES
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        if (materialForm.id) {
          const res = await updateMaterialAction(materialForm.id, {
            name: materialForm.name,
            category: materialForm.category,
            unit: materialForm.unit,
            currentStock: Number(materialForm.currentStock),
            minimumStock: Number(materialForm.minimumStock),
            estimatedCostUnit: Number(materialForm.estimatedCostUnit),
          })
          if (!res.success) throw new Error(res.error)
          setMaterials((prev) => prev.map((m) => (m.id === materialForm.id ? res.material : m)))
        } else {
          const res = await createMaterialAction({
            name: materialForm.name,
            category: materialForm.category,
            unit: materialForm.unit,
            currentStock: Number(materialForm.currentStock),
            minimumStock: Number(materialForm.minimumStock),
            estimatedCostUnit: Number(materialForm.estimatedCostUnit),
          })
          if (!res.success) throw new Error(res.error)
          setMaterials((prev) => [res.material, ...prev])
        }
        setShowMaterialModal(null)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleDeleteMaterial = (id: string, name: string) => {
    if (!confirm(`¿Eliminar el material "${name}" del inventario?`)) return
    startTransition(async () => {
      try {
        const res = await deleteMaterialAction(id)
        if (!res.success) throw new Error(res.error)
        setMaterials((prev) => prev.filter((m) => m.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleSaveInventory = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await recordMaterialConsumptionAction({
          materialId: invMaterialId,
          type: invType,
          quantity: Number(invQuantity),
          reason: invReason,
        })
        setMaterials((prev) => prev.map((m) => (m.id === invMaterialId ? res.material : m)))
        setInventoryMovements((prev) => [res.movement, ...prev])
        setShowInventoryModal(false)
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  // GUARDAR CONFIGURACIÓN
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await updateSalonSettingsAction({
          salonName: settingsForm.salonName,
          currency: settingsForm.currency,
          defaultDepositPercentage: Number(settingsForm.defaultDepositPercentage),
          minCancelHoursNotice: Number(settingsForm.minCancelHoursNotice),
          autoConfirmPublicBookings: Boolean(settingsForm.autoConfirmPublicBookings),
          allowSimultaneousServices: Boolean(settingsForm.allowSimultaneousServices),
          cancellationPolicyText: settingsForm.cancellationPolicyText,
          businessHoursStart: settingsForm.businessHoursStart,
          businessHoursEnd: settingsForm.businessHoursEnd,
        })
        if (!res.success) throw new Error(res.error)
        setSettings(res.settings)
        alert('Configuración guardada exitosamente')
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  return (
    <main className="dashboard-container">
      {/* SIDEBAR NAVEGACIÓN */}
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>Atelier Beauty</h3>
            <span>Gestión Profesional</span>
          </div>
        </div>

        <nav className="nav-menu">
          {[
            { id: 'Resumen', label: 'Resumen', icon: TrendingUp },
            { id: 'Agenda', label: 'Agenda', icon: Calendar },
            { id: 'Reservas', label: 'Reservas', icon: CalendarDays },
            { id: 'Clientes', label: 'Clientes', icon: Users },
            { id: 'Servicios', label: 'Servicios', icon: Scissors },
            { id: 'Profesionales', label: 'Profesionales', icon: Users },
            { id: 'Pagos', label: 'Pagos & Señas', icon: DollarSign },
            { id: 'Inventario', label: 'Inventario', icon: Package },
            { id: 'Reportes', label: 'Reportes', icon: Layers },
            { id: 'Configuración', label: 'Configuración', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id as any)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'Reservas' && pendingAppointments.length > 0 && (
                <span className="nav-badge">{pendingAppointments.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/reservar" target="_blank" className="public-booking-btn">
            <Sparkles size={16} /> Portal Público Online
          </a>
          <div className="connection-status">
            {isOnline ? (
              <span className="online"><Wifi size={14} /> Sistema en línea</span>
            ) : (
              <span className="offline"><WifiOff size={14} /> Modo local sin conexión</span>
            )}
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <section className="main-viewport">
        {/* TOPBAR */}
        <header className="topbar-header">
          <div className="topbar-title">
            <h2>{activeTab}</h2>
            <p>Atelier Beauty Studio · Salón Manos, Pies y Pestañas</p>
          </div>
          <div className="topbar-actions">
            <button
              className="primary-button-accent"
              onClick={() => {
                setFormError('')
                setShowNewAppointmentModal(true)
              }}
            >
              <Plus size={18} /> Nuevo Turno
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* 1. RESUMEN / DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Resumen' && (
          <div className="tab-content">
            <div className="stats-row">
              <div className="stat-box">
                <div className="stat-icon rose"><CalendarDays size={20} /></div>
                <div>
                  <span className="stat-label">Turnos de hoy</span>
                  <h3>{todayAppointments.length}</h3>
                  <small className="stat-detail">Turnos programados para hoy</small>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-icon lilac"><Clock3 size={20} /></div>
                <div>
                  <span className="stat-label">Pendientes de confirmación</span>
                  <h3>{pendingAppointments.length}</h3>
                  <small className="stat-detail">Requieren aprobación</small>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-icon mint"><Users size={20} /></div>
                <div>
                  <span className="stat-label">Base de clientas</span>
                  <h3>{clients.length}</h3>
                  <small className="stat-detail">Personas registradas</small>
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-icon gold"><DollarSign size={20} /></div>
                <div>
                  <span className="stat-label">Ingresos del mes</span>
                  <h3>${totalMonthRevenue.toLocaleString('es-AR')}</h3>
                  <small className="stat-detail">ARS recaudados</small>
                </div>
              </div>
            </div>

            <div className="dashboard-double-panel">
              {/* Turnos de hoy */}
              <div className="panel-card">
                <div className="panel-card-head">
                  <h3>Turnos para hoy ({todayAppointments.length})</h3>
                  <button className="text-link" onClick={() => setActiveTab('Agenda')}>Ver agenda completa</button>
                </div>
                {todayAppointments.length === 0 ? (
                  <p className="empty-copy">No hay turnos registrados para hoy.</p>
                ) : (
                  <div className="agenda-list">
                    {todayAppointments.map((apt) => (
                      <div key={apt.id} className="agenda-item-card">
                        <span className="time-badge">{apt.time} hs</span>
                        <div className="item-meta">
                          <b>{apt.clientName}</b>
                          <span>{apt.serviceName} · {apt.professional}</span>
                        </div>
                        <span className={`status-pill ${apt.status}`}>{apt.status}</span>
                        <span className={`payment-pill ${apt.paymentStatus}`}>{apt.paymentStatus}</span>
                        <button
                          className="action-btn"
                          onClick={() => setShowPaymentModal(apt)}
                          title="Registrar pago o seña"
                        >
                          <CreditCard size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones rápidas y servicios más pedidos */}
              <div className="panel-card">
                <div className="panel-card-head">
                  <h3>Servicios destacados</h3>
                  <button className="text-link" onClick={() => setActiveTab('Servicios')}>Ver catálogo</button>
                </div>
                <div className="catalog-preview-list">
                  {services.slice(0, 4).map((s) => (
                    <div key={s.id} className="catalog-preview-item">
                      <div>
                        <b>{s.name}</b>
                        <small>{s.durationMinutes} min · ${Number(s.price).toLocaleString('es-AR')} ARS</small>
                      </div>
                      <span className="badge-cat">{s.categoryId.replace('cat-', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. AGENDA Y CALENDARIO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Agenda' && (
          <div className="tab-content">
            <div className="agenda-filters-bar">
              <div className="filter-group">
                <Filter size={16} />
                <select
                  value={selectedProfessionalFilter}
                  onChange={(e) => setSelectedProfessionalFilter(e.target.value)}
                >
                  <option value="all">Todas las profesionales</option>
                  {initialData.professionals.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending_confirmation">Pendiente confirmación</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="in_progress">En curso</option>
                  <option value="completed">Finalizado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="view-toggle">
                <button className={`view-btn ${agendaView === 'day' ? 'active' : ''}`} onClick={() => setAgendaView('day')}>Día</button>
                <button className={`view-btn ${agendaView === 'week' ? 'active' : ''}`} onClick={() => setAgendaView('week')}>Semana</button>
                <button className={`view-btn ${agendaView === 'month' ? 'active' : ''}`} onClick={() => setAgendaView('month')}>Mes</button>
              </div>
            </div>

            <div className="agenda-calendar-panel">
              {filteredAppointments.length === 0 ? (
                <p className="empty-copy">No hay turnos con los filtros seleccionados.</p>
              ) : (
                <div className="calendar-appointments-grid">
                  {filteredAppointments.map((apt) => (
                    <div key={apt.id} className={`appointment-block ${apt.status}`}>
                      <div className="block-top">
                        <span className="block-time">{apt.date} · {apt.time} hs</span>
                        <span className={`status-pill ${apt.status}`}>{apt.status}</span>
                      </div>
                      <h4 className="block-client">{apt.clientName}</h4>
                      <p className="block-service">{apt.serviceName}</p>
                      <div className="block-meta">
                        <span>Profesional: <b>{apt.professional}</b></span>
                        <span>Total: <b>${Number(apt.totalPrice).toLocaleString('es-AR')}</b></span>
                        <span className={`payment-pill ${apt.paymentStatus}`}>Pago: {apt.paymentStatus}</span>
                      </div>

                      {/* Botones de acción del turno */}
                      <div className="block-actions">
                        {apt.status === 'pending_confirmation' && (
                          <button
                            className="btn-sm btn-confirm"
                            onClick={() => handleStatusChange(apt.id, 'confirmed')}
                          >
                            <CheckCircle size={14} /> Confirmar
                          </button>
                        )}
                        {apt.status === 'confirmed' && (
                          <button
                            className="btn-sm btn-progress"
                            onClick={() => handleStatusChange(apt.id, 'in_progress')}
                          >
                            Iniciar
                          </button>
                        )}
                        {apt.status === 'in_progress' && (
                          <button
                            className="btn-sm btn-complete"
                            onClick={() => handleStatusChange(apt.id, 'completed')}
                          >
                            Finalizar
                          </button>
                        )}
                        <button
                          className="btn-sm btn-pay"
                          onClick={() => setShowPaymentModal(apt)}
                        >
                          <CreditCard size={14} /> Pago
                        </button>
                        <button
                          className="btn-sm btn-reschedule"
                          onClick={() => {
                            setShowRescheduleModal(apt)
                            setRescheduleDate(apt.date)
                            setRescheduleTime(apt.time)
                          }}
                        >
                          <RotateCcw size={14} /> Reprogramar
                        </button>
                        {apt.status !== 'cancelled' && (
                          <button
                            className="btn-sm btn-cancel"
                            onClick={() => setShowCancelModal(apt)}
                          >
                            <Ban size={14} /> Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 3. RESERVAS */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Reservas' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <h3>Listado integral de reservas</h3>
                <span>{appointments.length} turnos registrados</span>
              </div>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Servicio</th>
                      <th>Profesional</th>
                      <th>Importe</th>
                      <th>Estado</th>
                      <th>Pago</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => (
                      <tr key={apt.id}>
                        <td><b>{apt.date}</b> {apt.time} hs</td>
                        <td>{apt.clientName}</td>
                        <td>{apt.clientPhone}</td>
                        <td>{apt.serviceName}</td>
                        <td>{apt.professional}</td>
                        <td>${Number(apt.totalPrice).toLocaleString('es-AR')}</td>
                        <td><span className={`status-pill ${apt.status}`}>{apt.status}</span></td>
                        <td><span className={`payment-pill ${apt.paymentStatus}`}>{apt.paymentStatus}</span></td>
                        <td>
                          <button className="btn-sm" onClick={() => setShowPaymentModal(apt)}>Cobrar</button>
                          <button className="btn-sm" onClick={() => setShowRescheduleModal(apt)}>Mover</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 4. CLIENTES */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Clientes' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Directorio de Clientes</h3>
                  <p>{clients.length} personas registradas</p>
                </div>
                <button
                  className="primary-button-sm"
                  onClick={() => {
                    setClientForm({ id: '', name: '', phone: '', email: '', notes: '' })
                    setShowClientModal(true)
                  }}
                >
                  <Plus size={16} /> Nuevo Cliente
                </button>
              </div>

              <div className="search-bar">
                <Search size={18} />
                <input
                  placeholder="Buscar clienta por nombre o teléfono..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                />
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Email</th>
                      <th>Visitas</th>
                      <th>Observaciones</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients
                      .filter((c) =>
                        `${c.name} ${c.phone}`.toLowerCase().includes(clientSearchQuery.toLowerCase())
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td><b>{c.name}</b></td>
                          <td>{c.phone}</td>
                          <td>{c.email || '—'}</td>
                          <td><span className="visits-badge">{c.visits} turnos</span></td>
                          <td>{c.notes || '—'}</td>
                          <td>
                            <button
                              className="btn-sm"
                              onClick={() => {
                                setClientForm({
                                  id: c.id,
                                  name: c.name,
                                  phone: c.phone,
                                  email: c.email || '',
                                  notes: c.notes || '',
                                })
                                setShowClientModal(true)
                              }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 5. SERVICIOS (ABM / CRUD) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Servicios' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Catálogo de Servicios y Técnicas</h3>
                  <p>Precios, tiempos de preparación y limpieza</p>
                </div>
                <button
                  className="primary-button-sm"
                  onClick={() => {
                    setServiceForm({
                      id: '',
                      categoryId: initialData.categories[0]?.id || 'cat-manos',
                      name: '',
                      description: '',
                      price: '18500',
                      durationMinutes: 60,
                      prepMinutes: 5,
                      cleanupMinutes: 10,
                      depositType: 'percentage',
                      depositValue: 30,
                      allowPublicBooking: true,
                    })
                    setShowServiceModal('new')
                  }}
                >
                  <Plus size={16} /> Nuevo Servicio
                </button>
              </div>
              <div className="services-admin-grid">
                {services.map((s) => (
                  <div key={s.id} className="service-admin-card">
                    <div className="srv-card-top">
                      <h4>{s.name}</h4>
                      <span className="srv-price">${Number(s.price).toLocaleString('es-AR')} ARS</span>
                    </div>
                    <p className="srv-desc">{s.description}</p>
                    <div className="srv-times">
                      <span>Duración: <b>{s.durationMinutes} min</b></span>
                      <span>Preparación: <b>{s.prepMinutes} min</b></span>
                      <span>Limpieza: <b>{s.cleanupMinutes} min</b></span>
                    </div>
                    <div className="srv-policy">
                      <small>Seña requerida: {s.depositType === 'fixed' ? `$${s.depositValue}` : `${s.depositValue}%`}</small>
                    </div>
                    <div className="srv-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f2ded9', paddingTop: '0.75rem' }}>
                      <button
                        className="btn-sm"
                        onClick={() => {
                          setServiceForm({
                            id: s.id,
                            categoryId: s.categoryId,
                            name: s.name,
                            description: s.description || '',
                            price: String(Number(s.price)),
                            durationMinutes: s.durationMinutes,
                            prepMinutes: s.prepMinutes,
                            cleanupMinutes: s.cleanupMinutes,
                            depositType: s.depositType as any,
                            depositValue: Number(s.depositValue),
                            allowPublicBooking: s.allowPublicBooking,
                          })
                          setShowServiceModal(s)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-sm btn-cancel"
                        onClick={() => handleDeleteService(s.id, s.name)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 6. PROFESIONALES (ABM / CRUD) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Profesionales' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Equipo de Profesionales</h3>
                  <p>Especialidades y disponibilidad</p>
                </div>
                <button
                  className="primary-button-sm"
                  onClick={() => {
                    setProForm({
                      id: '',
                      name: '',
                      phone: '',
                      email: '',
                      specialties: '',
                      initials: '',
                    })
                    setShowProfessionalModal('new')
                  }}
                >
                  <Plus size={16} /> Nueva Profesional
                </button>
              </div>
              <div className="professionals-grid">
                {professionals.map((p) => (
                  <div key={p.id} className="pro-admin-card">
                    <div className="pro-avatar-big">{p.initials || p.name.substring(0, 2)}</div>
                    <h4>{p.name}</h4>
                    <p className="pro-spec">{p.specialties || 'Sin especialidad configurada'}</p>
                    <div className="pro-contact">
                      <span>Tel: {p.phone}</span>
                      <span>Email: {p.email || '—'}</span>
                    </div>
                    <div className="pro-badge-available">
                      <CheckCircle size={14} color="#2e7d32" /> Activa en agenda
                    </div>
                    <div className="pro-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f2ded9', paddingTop: '0.75rem' }}>
                      <button
                        className="btn-sm"
                        onClick={() => {
                          setProForm({
                            id: p.id,
                            name: p.name,
                            phone: p.phone,
                            email: p.email || '',
                            specialties: p.specialties || '',
                            initials: p.initials || '',
                          })
                          setShowProfessionalModal(p)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-sm btn-cancel"
                        onClick={() => handleDeleteProfessional(p.id, p.name)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 7. PAGOS Y SEÑAS */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Pagos' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <h3>Historial Financiero y Movimientos</h3>
                <p>Señas, pagos en recepción y transferencias</p>
              </div>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Importe</th>
                      <th>Tipo</th>
                      <th>Medio</th>
                      <th>Estado</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id}>
                        <td>{pay.createdAt?.split('T')[0] || todayStr}</td>
                        <td><b>${Number(pay.amount).toLocaleString('es-AR')} ARS</b></td>
                        <td><span className="type-badge">{pay.type}</span></td>
                        <td>{pay.method}</td>
                        <td><span className="status-pill confirmed">{pay.status}</span></td>
                        <td>{pay.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 8. INVENTARIO */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Inventario' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Control de Stock y Materiales (ABM)</h3>
                  <p>Insumos, consumos estimados y alertas de stock mínimo</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="primary-button-sm"
                    onClick={() => {
                      setMaterialForm({
                        id: '',
                        name: '',
                        category: 'Manicuría',
                        unit: 'unidades',
                        currentStock: '10',
                        minimumStock: '3',
                        estimatedCostUnit: '0',
                      })
                      setShowMaterialModal('new')
                    }}
                  >
                    <Plus size={16} /> Nuevo Material
                  </button>
                  <button className="secondary-button" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setShowInventoryModal(true)}>
                    <Layers size={16} /> Registrar Movimiento
                  </button>
                </div>
              </div>

              <div className="materials-grid">
                {materials.map((m) => {
                  const isLow = Number(m.currentStock) <= Number(m.minStock || m.minimumStock)
                  return (
                    <div key={m.id} className={`material-card ${isLow ? 'low-stock' : ''}`}>
                      <div className="mat-head">
                        <h4>{m.name}</h4>
                        {isLow && (
                          <span className="low-stock-alert">
                            <AlertTriangle size={14} /> Stock Crítico
                          </span>
                        )}
                      </div>
                      <p className="mat-cat">{m.category}</p>
                      <div className="mat-stock">
                        <span>Stock actual: <b>{m.currentStock} {m.unit}</b></span>
                        <span>Mínimo: {m.minStock || m.minimumStock} {m.unit}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f2ded9', paddingTop: '0.75rem' }}>
                        <button
                          className="btn-sm"
                          onClick={() => {
                            setMaterialForm({
                              id: m.id,
                              name: m.name,
                              category: m.category,
                              unit: m.unit,
                              currentStock: String(m.currentStock),
                              minimumStock: String(m.minStock || m.minimumStock),
                              estimatedCostUnit: String(m.estimatedCostUnit || 0),
                            })
                            setShowMaterialModal(m)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-sm btn-cancel"
                          onClick={() => handleDeleteMaterial(m.id, m.name)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Últimos movimientos de stock</h4>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Nuevo Stock</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryMovements.map((mov) => (
                      <tr key={mov.id}>
                        <td>{mov.materialName}</td>
                        <td><span className="type-badge">{mov.type}</span></td>
                        <td>{mov.quantity}</td>
                        <td>{mov.newStock}</td>
                        <td>{mov.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 9. REPORTES */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Reportes' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <h3>Reportes del Período</h3>
                <p>Métricas consolidadas de rendimiento</p>
              </div>
              <div className="reports-grid">
                <div className="report-metric">
                  <span>Total de turnos agendados</span>
                  <strong>{appointments.length}</strong>
                </div>
                <div className="report-metric">
                  <span>Turnos confirmados / completados</span>
                  <strong>{appointments.filter((a) => a.status === 'confirmed' || a.status === 'completed').length}</strong>
                </div>
                <div className="report-metric">
                  <span>Turnos cancelados</span>
                  <strong>{appointments.filter((a) => a.status === 'cancelled').length}</strong>
                </div>
                <div className="report-metric">
                  <span>Total facturado en ARS</span>
                  <strong>${totalMonthRevenue.toLocaleString('es-AR')}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 10. CONFIGURACIÓN */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'Configuración' && (
          <div className="tab-content">
            <div className="panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Parámetros del Salón (ABM Configuración)</h3>
                  <p>Políticas de reserva, señas requeridas, anticipación y reglas de atención</p>
                </div>
              </div>
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
                <div className="input-row">
                  <label>
                    Nombre del Salón:
                    <input
                      required
                      value={settingsForm.salonName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, salonName: e.target.value })}
                    />
                  </label>
                  <label>
                    Moneda Oficial:
                    <input
                      required
                      value={settingsForm.currency}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                    />
                  </label>
                </div>

                <div className="input-row">
                  <label>
                    Porcentaje de Seña por Defecto (%):
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={settingsForm.defaultDepositPercentage}
                      onChange={(e) => setSettingsForm({ ...settingsForm, defaultDepositPercentage: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Anticipación mínima para cancelar (horas):
                    <input
                      type="number"
                      required
                      min="1"
                      value={settingsForm.minCancelHoursNotice}
                      onChange={(e) => setSettingsForm({ ...settingsForm, minCancelHoursNotice: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <div className="input-row">
                  <label>
                    Horario de Apertura:
                    <input
                      type="time"
                      value={settingsForm.businessHoursStart}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessHoursStart: e.target.value })}
                    />
                  </label>
                  <label>
                    Horario de Cierre:
                    <input
                      type="time"
                      value={settingsForm.businessHoursEnd}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessHoursEnd: e.target.value })}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '2rem', padding: '1rem', background: '#faf5f3', borderRadius: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={settingsForm.autoConfirmPublicBookings}
                      onChange={(e) => setSettingsForm({ ...settingsForm, autoConfirmPublicBookings: e.target.checked })}
                    />
                    <b>Confirmar automáticamente reservas online</b>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={settingsForm.allowSimultaneousServices}
                      onChange={(e) => setSettingsForm({ ...settingsForm, allowSimultaneousServices: e.target.checked })}
                    />
                    <b>Habilitar servicios simultáneos</b>
                  </label>
                </div>

                <label>
                  Texto de Políticas de Reserva y Cancelación:
                  <textarea
                    rows={3}
                    value={settingsForm.cancellationPolicyText}
                    onChange={(e) => setSettingsForm({ ...settingsForm, cancellationPolicyText: e.target.value })}
                  />
                </label>

                <div>
                  <button type="submit" className="primary-button-accent" disabled={isPending}>
                    {isPending ? 'Guardando cambios...' : 'Guardar Parámetros de Configuración'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: NUEVO TURNO INTERNO */}
      {/* -------------------------------------------------------------------- */}
      {showNewAppointmentModal && (
        <div className="modal-backdrop" onClick={() => setShowNewAppointmentModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Crear Nuevo Turno Interno</h3>
              <button className="icon-btn" onClick={() => setShowNewAppointmentModal(false)}>
                <X size={18} />
              </button>
            </div>
            {formError && <p className="error-copy">{formError}</p>}
            <form onSubmit={handleCreateInternalAppointment}>
              <div className="client-toggle-group">
                <button
                  type="button"
                  className={formClientMode === 'existing' ? 'active' : ''}
                  onClick={() => setFormClientMode('existing')}
                >
                  Clienta Existente
                </button>
                <button
                  type="button"
                  className={formClientMode === 'new' ? 'active' : ''}
                  onClick={() => setFormClientMode('new')}
                >
                  Nueva Clienta
                </button>
              </div>

              {formClientMode === 'existing' ? (
                <label>
                  Seleccionar Clienta:
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="input-row">
                  <label>
                    Nombre y Apellido:
                    <input
                      required
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      placeholder="Ej. Valentina Ramos"
                    />
                  </label>
                  <label>
                    Teléfono:
                    <input
                      required
                      value={formClientPhone}
                      onChange={(e) => setFormClientPhone(e.target.value)}
                      placeholder="11 5555 1234"
                    />
                  </label>
                </div>
              )}

              <label>
                Servicio:
                <select
                  value={formServiceId}
                  onChange={(e) => setFormServiceId(e.target.value)}
                  required
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · ${Number(s.price).toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Profesional Responsable:
                <select
                  value={formProId}
                  onChange={(e) => setFormProId(e.target.value)}
                  required
                >
                  {initialData.professionals.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <div className="input-row">
                <label>
                  Fecha:
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Hora:
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="input-row">
                <label>
                  Seña Inicial (ARS):
                  <input
                    type="number"
                    value={formDepositAmount}
                    onChange={(e) => setFormDepositAmount(e.target.value)}
                  />
                </label>
                <label>
                  Medio de Pago Seña:
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </div>

              <label>
                Observaciones:
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Detalles sobre diseño, preferencias o alergias"
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowNewAppointmentModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={isPending}>
                  {isPending ? 'Guardando...' : 'Confirmar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: COBRAR O REGISTRAR PAGO */}
      {/* -------------------------------------------------------------------- */}
      {showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Registrar Pago / Seña</h3>
              <button className="icon-btn" onClick={() => setShowPaymentModal(null)}><X size={18} /></button>
            </div>
            <div className="payment-target-info">
              <p>Turno: <b>{showPaymentModal.serviceName}</b></p>
              <p>Cliente: <b>{showPaymentModal.clientName}</b></p>
              <p>Total a abonar: <b>${Number(showPaymentModal.totalPrice).toLocaleString('es-AR')} ARS</b></p>
            </div>
            <form onSubmit={handleRegisterPayment}>
              <label>
                Importe (ARS):
                <input
                  type="number"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ej. 10000"
                />
              </label>
              <div className="input-row">
                <label>
                  Tipo de Operación:
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}>
                    <option value="deposit">Seña</option>
                    <option value="partial">Pago parcial</option>
                    <option value="full">Pago total</option>
                    <option value="refund">Reembolso / Devolución</option>
                  </select>
                </label>
                <label>
                  Medio de Pago:
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </div>
              <label>
                Comprobante o Detalle:
                <input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Nro comprobante / Observación"
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowPaymentModal(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: REPROGRAMAR TURNO */}
      {/* -------------------------------------------------------------------- */}
      {showRescheduleModal && (
        <div className="modal-backdrop" onClick={() => setShowRescheduleModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Reprogramar Turno</h3>
              <button className="icon-btn" onClick={() => setShowRescheduleModal(null)}><X size={18} /></button>
            </div>
            <p>Cliente: <b>{showRescheduleModal.clientName}</b> ({showRescheduleModal.serviceName})</p>
            <form onSubmit={handleConfirmReschedule}>
              <div className="input-row">
                <label>
                  Nueva Fecha:
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </label>
                <label>
                  Nuevo Horario:
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowRescheduleModal(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar Cambio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: CANCELAR TURNO */}
      {/* -------------------------------------------------------------------- */}
      {showCancelModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Cancelar Turno</h3>
              <button className="icon-btn" onClick={() => setShowCancelModal(null)}><X size={18} /></button>
            </div>
            <p>¿Estás seguro de cancelar el turno de <b>{showCancelModal.clientName}</b>?</p>
            <form onSubmit={handleConfirmCancel}>
              <label>
                Motivo de cancelación:
                <textarea
                  required
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowCancelModal(null)}>Volver</button>
                <button type="submit" className="primary-button danger" disabled={isPending}>Confirmar Cancelación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: CLIENTE */}
      {/* -------------------------------------------------------------------- */}
      {showClientModal && (
        <div className="modal-backdrop" onClick={() => setShowClientModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{clientForm.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button className="icon-btn" onClick={() => setShowClientModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveClient}>
              <label>
                Nombre Completo:
                <input
                  required
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                />
              </label>
              <label>
                Teléfono:
                <input
                  required
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </label>
              <label>
                Email (opcional):
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowClientModal(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ABM SERVICIO */}
      {/* -------------------------------------------------------------------- */}
      {showServiceModal && (
        <div className="modal-backdrop" onClick={() => setShowServiceModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{serviceForm.id ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
              <button className="icon-btn" onClick={() => setShowServiceModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveService}>
              <label>
                Categoría:
                <select
                  value={serviceForm.categoryId}
                  onChange={(e) => setServiceForm({ ...serviceForm, categoryId: e.target.value })}
                >
                  {initialData.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Nombre del Servicio:
                <input
                  required
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="Ej. Uñas Acrílicas Esculpidas"
                />
              </label>
              <label>
                Descripción:
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  placeholder="Detalles sobre el procedimiento..."
                />
              </label>
              <div className="input-row">
                <label>
                  Precio (ARS):
                  <input
                    type="number"
                    required
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                  />
                </label>
                <label>
                  Duración Neta (minutos):
                  <input
                    type="number"
                    required
                    value={serviceForm.durationMinutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, durationMinutes: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="input-row">
                <label>
                  Tiempo de Preparación (min):
                  <input
                    type="number"
                    value={serviceForm.prepMinutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, prepMinutes: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Tiempo de Limpieza (min):
                  <input
                    type="number"
                    value={serviceForm.cleanupMinutes}
                    onChange={(e) => setServiceForm({ ...serviceForm, cleanupMinutes: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="input-row">
                <label>
                  Tipo de Seña:
                  <select
                    value={serviceForm.depositType}
                    onChange={(e) => setServiceForm({ ...serviceForm, depositType: e.target.value as any })}
                  >
                    <option value="percentage">Porcentual (%)</option>
                    <option value="fixed">Fija ($)</option>
                  </select>
                </label>
                <label>
                  Valor de Seña:
                  <input
                    type="number"
                    value={serviceForm.depositValue}
                    onChange={(e) => setServiceForm({ ...serviceForm, depositValue: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowServiceModal(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar Servicio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ABM PROFESIONAL */}
      {/* -------------------------------------------------------------------- */}
      {showProfessionalModal && (
        <div className="modal-backdrop" onClick={() => setShowProfessionalModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{proForm.id ? 'Editar Profesional' : 'Nueva Profesional'}</h3>
              <button className="icon-btn" onClick={() => setShowProfessionalModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveProfessional}>
              <label>
                Nombre y Apellido:
                <input
                  required
                  value={proForm.name}
                  onChange={(e) => setProForm({ ...proForm, name: e.target.value })}
                  placeholder="Ej. Camila Morales"
                />
              </label>
              <div className="input-row">
                <label>
                  Teléfono:
                  <input
                    required
                    value={proForm.phone}
                    onChange={(e) => setProForm({ ...proForm, phone: e.target.value })}
                    placeholder="11 5555 7777"
                  />
                </label>
                <label>
                  Iniciales:
                  <input
                    value={proForm.initials}
                    onChange={(e) => setProForm({ ...proForm, initials: e.target.value })}
                    placeholder="CM"
                  />
                </label>
              </div>
              <label>
                Email (opcional):
                <input
                  type="email"
                  value={proForm.email}
                  onChange={(e) => setProForm({ ...proForm, email: e.target.value })}
                  placeholder="camila@atelier.com"
                />
              </label>
              <label>
                Especialidades:
                <input
                  value={proForm.specialties}
                  onChange={(e) => setProForm({ ...proForm, specialties: e.target.value })}
                  placeholder="Ej. Uñas esculpidas, Kapping y Polygel"
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowProfessionalModal(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar Profesional</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ABM MATERIAL */}
      {/* -------------------------------------------------------------------- */}
      {showMaterialModal && (
        <div className="modal-backdrop" onClick={() => setShowMaterialModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{materialForm.id ? 'Editar Material' : 'Nuevo Material'}</h3>
              <button className="icon-btn" onClick={() => setShowMaterialModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveMaterial}>
              <label>
                Nombre del Material:
                <input
                  required
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  placeholder="Ej. Polímero Acrílico Transparente"
                />
              </label>
              <div className="input-row">
                <label>
                  Categoría:
                  <input
                    required
                    value={materialForm.category}
                    onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                    placeholder="Manicuría / Pestañas / etc."
                  />
                </label>
                <label>
                  Unidad de Medida:
                  <input
                    required
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    placeholder="gramos / ml / unidades"
                  />
                </label>
              </div>
              <div className="input-row">
                <label>
                  Stock Actual:
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={materialForm.currentStock}
                    onChange={(e) => setMaterialForm({ ...materialForm, currentStock: e.target.value })}
                  />
                </label>
                <label>
                  Stock Mínimo (Alerta):
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={materialForm.minimumStock}
                    onChange={(e) => setMaterialForm({ ...materialForm, minimumStock: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Costo Estimado Unitario (ARS):
                <input
                  type="number"
                  step="0.01"
                  value={materialForm.estimatedCostUnit}
                  onChange={(e) => setMaterialForm({ ...materialForm, estimatedCostUnit: e.target.value })}
                  placeholder="0"
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowMaterialModal(null)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Guardar Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: REGISTRAR MOVIMIENTO INVENTARIO */}
      {/* -------------------------------------------------------------------- */}
      {showInventoryModal && (
        <div className="modal-backdrop" onClick={() => setShowInventoryModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Registrar Movimiento de Material</h3>
              <button className="icon-btn" onClick={() => setShowInventoryModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveInventory}>
              <label>
                Material:
                <select value={invMaterialId} onChange={(e) => setInvMaterialId(e.target.value)}>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} (Stock: {m.currentStock} {m.unit})</option>
                  ))}
                </select>
              </label>
              <div className="input-row">
                <label>
                  Tipo:
                  <select value={invType} onChange={(e) => setInvType(e.target.value as any)}>
                    <option value="out">Consumo / Salida</option>
                    <option value="in">Ingreso de Compra</option>
                    <option value="adjustment">Ajuste de Conteo</option>
                    <option value="waste">Merma / Dañado</option>
                  </select>
                </label>
                <label>
                  Cantidad:
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={invQuantity}
                    onChange={(e) => setInvQuantity(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Motivo:
                <input
                  required
                  value={invReason}
                  onChange={(e) => setInvReason(e.target.value)}
                  placeholder="Ej. Uso en servicio de kapping"
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="secondary-button" onClick={() => setShowInventoryModal(false)}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={isPending}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
