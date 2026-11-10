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
  ChevronLeft,
  Trash2,
  Check,
} from 'lucide-react'
import {
  getAgendaPeriodRange,
  shiftAgendaDate,
  isAppointmentInPeriod,
} from '@/lib/agenda-filters'
import {
  createInternalAppointment,
  updateAppointmentStatusAction,
  rescheduleAppointmentAction,
  deleteAppointmentAction,
  registerAppointmentPaymentAction,
  recordMaterialConsumptionAction,
} from '@/app/actions/dashboard'
import { createClient, updateClient, deleteClient } from '@/app/actions/clients'
import { createService, updateService, deleteService } from '@/app/actions/services'
import {
  createProfessional,
  updateProfessional,
  deleteProfessional,
  saveScheduleAction,
  toggleScheduleAction,
  deleteScheduleAction,
} from '@/app/actions/professionals'
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
    schedules?: any[]
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
  const [schedules, setSchedules] = useState<any[]>(initialData.schedules || [])
  const [selectedProForSchedules, setSelectedProForSchedules] = useState<any | null>(null)
  const [isSchedulesModalOpen, setIsSchedulesModalOpen] = useState(false)
  const [materials, setMaterials] = useState<any[]>(initialData.materials)
  const [payments, setPayments] = useState<any[]>(initialData.payments)
  const [inventoryMovements, setInventoryMovements] = useState<any[]>(initialData.inventoryMovements)
  const [settings, setSettings] = useState<any>(initialData.settings)
  const [isOnline, setIsOnline] = useState(true)

  // Filtros de Agenda
  const [agendaView, setAgendaView] = useState<'day' | 'week' | 'month'>('week')
  const [agendaAnchorDate, setAgendaAnchorDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedProfessionalFilter, setSelectedProfessionalFilter] = useState('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')

  // Filtros de Reservas (Listado Integral)
  const [reservasSearchQuery, setReservasSearchQuery] = useState('')
  const [reservasProfessionalFilter, setReservasProfessionalFilter] = useState('all')
  const [reservasStatusFilter, setReservasStatusFilter] = useState('all')
  const [reservasPaymentFilter, setReservasPaymentFilter] = useState('all')

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

  // Período activo de la Agenda según la vista (día, semana, mes) y fecha de referencia
  const agendaPeriodRange = useMemo(() => {
    return getAgendaPeriodRange(agendaAnchorDate, agendaView)
  }, [agendaAnchorDate, agendaView])

  // Filtrado de turnos para la Agenda
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (!isAppointmentInPeriod(a.date, agendaPeriodRange)) return false
      if (selectedProfessionalFilter !== 'all' && a.professionalId !== selectedProfessionalFilter) return false
      if (selectedStatusFilter !== 'all' && a.status !== selectedStatusFilter) return false
      return true
    })
  }, [appointments, agendaPeriodRange, selectedProfessionalFilter, selectedStatusFilter])

  // Filtrado de reservas para el Listado Integral
  const filteredReservas = useMemo(() => {
    return appointments.filter((a) => {
      if (reservasProfessionalFilter !== 'all' && a.professionalId !== reservasProfessionalFilter) return false
      if (reservasStatusFilter !== 'all' && a.status !== reservasStatusFilter) return false
      if (reservasPaymentFilter !== 'all' && a.paymentStatus !== reservasPaymentFilter) return false
      if (reservasSearchQuery.trim()) {
        const query = reservasSearchQuery.toLowerCase()
        const matchClient = (a.clientName || '').toLowerCase().includes(query)
        const matchPhone = (a.clientPhone || '').toLowerCase().includes(query)
        const matchService = (a.serviceName || '').toLowerCase().includes(query)
        const matchPro = (a.professional || '').toLowerCase().includes(query)
        if (!matchClient && !matchPhone && !matchService && !matchPro) return false
      }
      return true
    })
  }, [appointments, reservasProfessionalFilter, reservasStatusFilter, reservasPaymentFilter, reservasSearchQuery])

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

  const handleOpenSchedulesModal = (pro: any) => {
    setSelectedProForSchedules(pro)
    setIsSchedulesModalOpen(true)
  }

  const handleSaveSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedProForSchedules) return
    const formData = new FormData(e.currentTarget)
    formData.set('professionalId', selectedProForSchedules.id)

    startTransition(async () => {
      try {
        const result = await saveScheduleAction(formData)
        setSchedules((prev) => {
          const index = prev.findIndex((s) => s.id === result.id)
          if (index >= 0) {
            const next = [...prev]
            next[index] = result
            return next
          }
          return [...prev, result]
        })
        const form = e.target as HTMLFormElement
        form.reset()
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleToggleSchedule = (id: string) => {
    startTransition(async () => {
      try {
        const updated = await toggleScheduleAction(id)
        setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleUpdateScheduleRow = (sched: any, field: string, val: any) => {
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('id', sched.id)
        fd.set('professionalId', sched.professionalId)
        fd.set('dayOfWeek', sched.dayOfWeek.toString())
        fd.set('startTime', field === 'startTime' ? val : sched.startTime)
        fd.set('endTime', field === 'endTime' ? val : sched.endTime)
        fd.set('breakStartTime', field === 'breakStartTime' ? val : sched.breakStartTime || '')
        fd.set('breakEndTime', field === 'breakEndTime' ? val : sched.breakEndTime || '')
        fd.set('isActive', field === 'isActive' ? String(val) : String(sched.isActive))

        const updated = await saveScheduleAction(fd)
        setSchedules((prev) => prev.map((s) => (s.id === sched.id ? updated : s)))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleDeleteSchedule = (id: string) => {
    if (!confirm('¿Eliminar la configuración horaria para este día?')) return
    startTransition(async () => {
      try {
        await deleteScheduleAction(id)
        setSchedules((prev) => prev.filter((s) => s.id !== id))
      } catch (err: any) {
        alert(err.message)
      }
    })
  }

  const handleDeleteAppointment = (appointmentId: string, clientName: string) => {
    if (!confirm(`¿Estás seguro de eliminar definitivamente la reserva de "${clientName}"?`)) return
    startTransition(async () => {
      try {
        await deleteAppointmentAction(appointmentId)
        setAppointments((prev) => prev.filter((a) => a.id !== appointmentId))
      } catch (err: any) {
        alert(err.message || 'Error al eliminar reserva')
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
            email: clientForm.email,
            notes: clientForm.notes,
          })
          setClients((prev) => prev.map((c) => (c.id === clientForm.id ? { ...c, ...updated } : c)))
        } else {
          const created = await createClient({
            name: clientForm.name,
            phone: clientForm.phone,
            email: clientForm.email,
            notes: clientForm.notes,
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

  const handleDeleteClient = (clientId: string, clientName: string) => {
    if (!confirm(`¿Eliminar o dar de baja a la clienta "${clientName}"?`)) return
    startTransition(async () => {
      try {
        await deleteClient(clientId)
        setClients((prev) => prev.filter((c) => c.id !== clientId))
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
                  <div>
                    <h3>Turnos para hoy ({todayAppointments.length})</h3>
                    <span className="panel-card-subtitle">{todayAppointments.length} turnos programados</span>
                  </div>
                  <button className="text-link" onClick={() => setActiveTab('Agenda')}>Ver agenda completa</button>
                </div>
                {todayAppointments.length === 0 ? (
                  <p className="empty-copy">No hay turnos registrados para hoy.</p>
                ) : (
                  <div className="agenda-list">
                    {todayAppointments.map((apt) => (
                      <div key={apt.id} className="agenda-item-card">
                        <div className="agenda-item-time">
                          <span className="time-badge">{apt.time}</span>
                          <span className="time-unit">hs</span>
                        </div>
                        <div className="item-meta">
                          <span className="item-client-name">{apt.clientName}</span>
                          <span className="item-details">{apt.serviceName} · {apt.professional}</span>
                        </div>
                        <div className="agenda-item-status-group">
                          <span className={`status-pill ${apt.status}`}>
                            {apt.status === 'confirmed' ? 'Confirmado' :
                              apt.status === 'pending_confirmation' ? 'Pendiente' :
                              apt.status === 'in_progress' ? 'En curso' :
                              apt.status === 'completed' ? 'Finalizado' :
                              apt.status === 'cancelled' ? 'Cancelado' : apt.status}
                          </span>
                          <span className={`payment-pill ${apt.paymentStatus}`}>
                            {apt.paymentStatus === 'paid' ? 'Abonado' :
                             apt.paymentStatus === 'deposit_paid' ? 'Señado' :
                             apt.paymentStatus === 'refunded' ? 'Reembolsado' : 'Pendiente'}
                          </span>
                        </div>
                        <button
                          className="action-btn"
                          onClick={() => setShowPaymentModal(apt)}
                          title="Registrar pago o seña"
                          aria-label={`Registrar pago o seña para turno de ${apt.clientName}`}
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
                  <div>
                    <h3>Servicios destacados</h3>
                    <span className="panel-card-subtitle">Catálogo principal del salón</span>
                  </div>
                  <button className="text-link" onClick={() => setActiveTab('Servicios')}>Ver catálogo</button>
                </div>
                <div className="catalog-preview-list">
                  {services.slice(0, 4).map((s) => (
                    <div
                      key={s.id}
                      className="catalog-preview-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveTab('Servicios')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveTab('Servicios');
                        }
                      }}
                    >
                      <div className="catalog-item-main">
                        <span className="srv-category-tag">{s.categoryId?.replace('cat-', '') || 'Sin categoría'}</span>
                        <h4 className="catalog-item-name">{s.name}</h4>
                        <div className="catalog-item-meta">
                          <span className="srv-time-badge"><Clock3 size={12} /> {s.durationMinutes} min</span>
                        </div>
                      </div>
                      <div className="catalog-item-price-side">
                        <span className="catalog-item-price">${Number(s.price).toLocaleString('es-AR')}</span>
                        <small className="catalog-item-currency">ARS</small>
                      </div>
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
                <span className="filter-icon-wrapper" aria-hidden="true">
                  <Filter size={15} />
                </span>
                <div className="filter-field">
                  <label htmlFor="agenda-filter-pro" className="sr-only">Filtrar por profesional</label>
                  <select
                    id="agenda-filter-pro"
                    className="agenda-select"
                    value={selectedProfessionalFilter}
                    onChange={(e) => setSelectedProfessionalFilter(e.target.value)}
                  >
                    <option value="all">Todas las profesionales</option>
                    {initialData.professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-field">
                  <label htmlFor="agenda-filter-status" className="sr-only">Filtrar por estado</label>
                  <select
                    id="agenda-filter-status"
                    className="agenda-select"
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
              </div>

              <div className="agenda-controls-right">
                <div className="agenda-date-navigator" role="region" aria-label="Navegación temporal de la agenda">
                  <button
                    type="button"
                    className="agenda-nav-btn"
                    onClick={() => setAgendaAnchorDate((prev) => shiftAgendaDate(prev, agendaView, -1))}
                    aria-label={`Período anterior (${agendaView === 'day' ? 'día' : agendaView === 'week' ? 'semana' : 'mes'} anterior)`}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="agenda-today-btn"
                    onClick={() => setAgendaAnchorDate(todayStr)}
                    title="Ir al día de hoy"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    className="agenda-nav-btn"
                    onClick={() => setAgendaAnchorDate((prev) => shiftAgendaDate(prev, agendaView, 1))}
                    aria-label={`Período siguiente (${agendaView === 'day' ? 'día' : agendaView === 'week' ? 'semana' : 'mes'} siguiente)`}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="view-toggle" role="group" aria-label="Vista del calendario">
                  <button
                    type="button"
                    className={`view-btn ${agendaView === 'day' ? 'active' : ''}`}
                    onClick={() => setAgendaView('day')}
                    aria-pressed={agendaView === 'day'}
                  >
                    Día
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${agendaView === 'week' ? 'active' : ''}`}
                    onClick={() => setAgendaView('week')}
                    aria-pressed={agendaView === 'week'}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${agendaView === 'month' ? 'active' : ''}`}
                    onClick={() => setAgendaView('month')}
                    aria-pressed={agendaView === 'month'}
                  >
                    Mes
                  </button>
                </div>
              </div>
            </div>

            {/* Banner con el rango / período activo de la agenda */}
            <div className="agenda-period-banner">
              <div className="agenda-period-info">
                <span className="agenda-period-icon" aria-hidden="true">
                  <Calendar size={16} />
                </span>
                <span className="agenda-period-label">{agendaPeriodRange.label}</span>
              </div>
              <div className="agenda-period-badge">
                <span>{filteredAppointments.length} {filteredAppointments.length === 1 ? 'turno' : 'turnos'}</span>
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
                        <span className={`status-pill ${apt.status}`}>
                          {apt.status === 'confirmed' ? 'Confirmado' :
                           apt.status === 'pending_confirmation' ? 'Pendiente' :
                           apt.status === 'in_progress' ? 'En curso' :
                           apt.status === 'completed' ? 'Finalizado' :
                           apt.status === 'cancelled' ? 'Cancelado' : apt.status}
                        </span>
                      </div>
                      <h4 className="block-client">{apt.clientName}</h4>
                      <p className="block-service">{apt.serviceName}</p>
                      <div className="block-meta">
                        <div className="meta-row">
                          <span className="meta-label">Profesional</span>
                          <span className="meta-value">{apt.professional}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-label">Total</span>
                          <span className="meta-value price">${Number(apt.totalPrice).toLocaleString('es-AR')}</span>
                        </div>
                        <div className="meta-row">
                          <span className="meta-label">Estado de pago</span>
                          <span className={`payment-pill ${apt.paymentStatus}`}>
                            {apt.paymentStatus === 'paid' ? 'Abonado' :
                             apt.paymentStatus === 'deposit_paid' ? 'Señado' :
                             apt.paymentStatus === 'refunded' ? 'Reembolsado' : 'Pendiente'}
                          </span>
                        </div>
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
                <div>
                  <h3>Listado integral de reservas</h3>
                  <span className="panel-card-subtitle">{appointments.length} turnos registrados en total</span>
                </div>
                <button
                  className="primary-button-sm"
                  onClick={() => {
                    setFormError('')
                    setShowNewAppointmentModal(true)
                  }}
                >
                  <Plus size={16} /> Nueva Reserva
                </button>
              </div>

              {/* Barra de Filtros y Búsqueda de Reservas */}
              <div className="reservas-filters-bar">
                <div className="search-bar reservas-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    placeholder="Buscar por cliente, teléfono, servicio o profesional..."
                    value={reservasSearchQuery}
                    onChange={(e) => setReservasSearchQuery(e.target.value)}
                    aria-label="Buscar en reservas"
                  />
                  {reservasSearchQuery && (
                    <button
                      type="button"
                      className="icon-btn-clear"
                      onClick={() => setReservasSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="reservas-filter-controls">
                  <div className="filter-field">
                    <label htmlFor="reservas-filter-pro" className="sr-only">Filtrar por profesional</label>
                    <select
                      id="reservas-filter-pro"
                      className="agenda-select"
                      value={reservasProfessionalFilter}
                      onChange={(e) => setReservasProfessionalFilter(e.target.value)}
                    >
                      <option value="all">Todas las profesionales</option>
                      {initialData.professionals.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="reservas-filter-status" className="sr-only">Filtrar por estado</label>
                    <select
                      id="reservas-filter-status"
                      className="agenda-select"
                      value={reservasStatusFilter}
                      onChange={(e) => setReservasStatusFilter(e.target.value)}
                    >
                      <option value="all">Todos los estados</option>
                      <option value="pending_confirmation">Pendiente confirmación</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="in_progress">En curso</option>
                      <option value="completed">Finalizado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="reservas-filter-payment" className="sr-only">Filtrar por pago</label>
                    <select
                      id="reservas-filter-payment"
                      className="agenda-select"
                      value={reservasPaymentFilter}
                      onChange={(e) => setReservasPaymentFilter(e.target.value)}
                    >
                      <option value="all">Todos los pagos</option>
                      <option value="pending">Pago pendiente</option>
                      <option value="deposit_paid">Señado</option>
                      <option value="partially_paid">Parcialmente abonado</option>
                      <option value="paid">Totalmente abonado</option>
                      <option value="refunded">Reembolsado</option>
                    </select>
                  </div>

                  {(reservasSearchQuery || reservasProfessionalFilter !== 'all' || reservasStatusFilter !== 'all' || reservasPaymentFilter !== 'all') && (
                    <button
                      type="button"
                      className="text-link"
                      style={{ fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                      onClick={() => {
                        setReservasSearchQuery('')
                        setReservasProfessionalFilter('all')
                        setReservasStatusFilter('all')
                        setReservasPaymentFilter('all')
                      }}
                    >
                      Restablecer filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Contador de resultados */}
              <div className="reservas-results-summary">
                <span>Mostrando <b>{filteredReservas.length}</b> de <b>{appointments.length}</b> reservas</span>
              </div>

              <div className="table-responsive">
                {filteredReservas.length === 0 ? (
                  <p className="empty-copy">No se encontraron reservas con los filtros seleccionados.</p>
                ) : (
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
                        <th>Acciones (ABM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReservas.map((apt) => (
                        <tr key={apt.id}>
                          <td><b>{apt.date}</b> {apt.time} hs</td>
                          <td>
                            <strong>{apt.clientName}</strong>
                            {apt.isPublicBooking && <span className="public-booking-tag" title="Reserva originada online">Online</span>}
                          </td>
                          <td>{apt.clientPhone}</td>
                          <td>{apt.serviceName}</td>
                          <td>{apt.professional}</td>
                          <td><b>${Number(apt.totalPrice).toLocaleString('es-AR')}</b></td>
                          <td>
                            <span className={`status-pill ${apt.status}`}>
                              {apt.status === 'confirmed' ? 'Confirmado' :
                               apt.status === 'pending_confirmation' ? 'Pendiente' :
                               apt.status === 'in_progress' ? 'En curso' :
                               apt.status === 'completed' ? 'Finalizado' :
                               apt.status === 'cancelled' ? 'Cancelado' : apt.status}
                            </span>
                          </td>
                          <td>
                            <span className={`payment-pill ${apt.paymentStatus}`}>
                              {apt.paymentStatus === 'paid' ? 'Abonado' :
                               apt.paymentStatus === 'deposit_paid' ? 'Señado' :
                               apt.paymentStatus === 'refunded' ? 'Reembolsado' : 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions-cluster">
                              {apt.status === 'pending_confirmation' && (
                                <button
                                  className="btn-sm btn-confirm"
                                  onClick={() => handleStatusChange(apt.id, 'confirmed')}
                                  title="Confirmar reserva"
                                >
                                  <CheckCircle size={13} /> Confirmar
                                </button>
                              )}
                              {apt.status === 'confirmed' && (
                                <button
                                  className="btn-sm btn-progress"
                                  onClick={() => handleStatusChange(apt.id, 'in_progress')}
                                  title="Iniciar atención"
                                >
                                  Iniciar
                                </button>
                              )}
                              {apt.status === 'in_progress' && (
                                <button
                                  className="btn-sm btn-complete"
                                  onClick={() => handleStatusChange(apt.id, 'completed')}
                                  title="Finalizar turno"
                                >
                                  Finalizar
                                </button>
                              )}
                              <button
                                className="btn-sm btn-pay"
                                onClick={() => setShowPaymentModal(apt)}
                                title="Registrar seña o cobro"
                              >
                                <CreditCard size={13} /> Cobrar
                              </button>
                              <button
                                className="btn-sm btn-reschedule"
                                onClick={() => {
                                  setShowRescheduleModal(apt)
                                  setRescheduleDate(apt.date)
                                  setRescheduleTime(apt.time)
                                }}
                                title="Reprogramar horario"
                              >
                                <RotateCcw size={13} /> Mover
                              </button>
                              {apt.status !== 'cancelled' ? (
                                <button
                                  className="btn-sm btn-cancel"
                                  onClick={() => setShowCancelModal(apt)}
                                  title="Cancelar reserva"
                                >
                                  <Ban size={13} /> Cancelar
                                </button>
                              ) : (
                                <button
                                  className="btn-sm btn-cancel"
                                  onClick={() => handleDeleteAppointment(apt.id, apt.clientName)}
                                  title="Eliminar registro definitivamente"
                                >
                                  <Trash2 size={13} /> Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                            <div className="table-actions-cluster">
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
                              <button
                                className="btn-sm btn-cancel"
                                onClick={() => handleDeleteClient(c.id, c.name)}
                                title="Eliminar clienta"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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
                      <div>
                        <span className="srv-category-tag">{s.categoryId?.replace('cat-', '') || 'Sin categoría'}</span>
                        <h4>{s.name}</h4>
                      </div>
                      <span className="srv-price">${Number(s.price).toLocaleString('es-AR')} <small>ARS</small></span>
                    </div>
                    {s.description && <p className="srv-desc">{s.description}</p>}
                    <div className="srv-times">
                      <div className="srv-time-badge">
                        <Clock3 size={13} />
                        <span><b>{s.durationMinutes} min</b> total</span>
                      </div>
                      {(Number(s.prepMinutes) > 0 || Number(s.cleanupMinutes) > 0) && (
                        <span className="srv-time-breakdown">
                          Prep {s.prepMinutes}m · Limp {s.cleanupMinutes}m
                        </span>
                      )}
                    </div>
                    <div className="srv-footer-row">
                      <span className="srv-policy-badge">
                        Seña: {s.depositType === 'fixed' ? `$${Number(s.depositValue).toLocaleString('es-AR')}` : `${Number(s.depositValue)}%`}
                      </span>
                      <div className="srv-card-actions">
                        <button
                          className="btn-link-edit"
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
                          className="btn-link-delete"
                          onClick={() => handleDeleteService(s.id, s.name)}
                        >
                          Eliminar
                        </button>
                      </div>
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
                    <div className="pro-card-header">
                      <div className="pro-avatar-big">{p.initials || p.name.substring(0, 2)}</div>
                      <div className="pro-info-head">
                        <h4>{p.name}</h4>
                        <span className="pro-badge-available">
                          <CheckCircle size={12} /> Activa en agenda
                        </span>
                      </div>
                    </div>
                    <p className="pro-spec">{p.specialties || 'Sin especialidad configurada'}</p>
                    <div className="pro-contact">
                      <span><b>Tel:</b> {p.phone}</span>
                      {p.email && <span><b>Email:</b> {p.email}</span>}
                    </div>

                    {/* Turnos y Horarios de atención */}
                    <div className="pro-schedule-section">
                      <div className="pro-schedule-header">
                        <span className="pro-schedule-title">Turnos y Horarios</span>
                        <button
                          type="button"
                          className="btn-schedule-manage"
                          onClick={() => handleOpenSchedulesModal(p)}
                        >
                          Configurar
                        </button>
                      </div>
                      <div className="/*pro-schedule-badges*/ sched-table-container">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dayName, idx) => {
                          const dayNum = (idx + 1) % 7
                          const sched = schedules.find((s) => s.professionalId === p.id && s.dayOfWeek === dayNum)
                          const isWorking = sched && sched.isActive
                          return (
                            <div
                              key={dayNum}
                              className={`sched-badge ${isWorking ? 'sched-badge-active' : 'sched-badge-inactive'}`}
                              title={
                                isWorking
                                  ? `${sched.startTime} - ${sched.endTime}${
                                      sched.breakStartTime ? ` (Pausa ${sched.breakStartTime} - ${sched.breakEndTime})` : ''
                                    }`
                                  : 'Franco / No disponible'
                              }
                            >
                              <span className="sched-badge-day">{dayName}</span>
                              <span className="sched-badge-hours">
                                {isWorking ? `${sched.startTime} - ${sched.endTime}` : 'Franco'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="pro-footer-row">
                      <div className="pro-card-actions">
                        <button
                          type="button"
                          className="btn-link-schedule"
                          onClick={() => handleOpenSchedulesModal(p)}
                        >
                          Turnos y Horarios
                        </button>
                        <button
                          className="btn-link-edit"
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
                          className="btn-link-delete"
                          onClick={() => handleDeleteProfessional(p.id, p.name)}
                        >
                          Desactivar
                        </button>
                      </div>
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
                  <h3>Control de Stock y Materiales</h3>
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
                        <div>
                          <span className="mat-cat-tag">{m.category}</span>
                          <h4>{m.name}</h4>
                        </div>
                        {isLow && (
                          <span className="low-stock-alert">
                            <AlertTriangle size={13} /> Crítico
                          </span>
                        )}
                      </div>
                      <div className="mat-stock-metric">
                        <span className="mat-stock-label">Stock actual</span>
                        <div className="mat-stock-num">
                          <b>{m.currentStock}</b> <small>{m.unit}</small>
                        </div>
                      </div>
                      <div className="mat-footer">
                        <span>Mínimo sugerido: {String(m.minStock || m.minimumStock)} {m.unit}</span>
                        {/* */}
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
                        {/* */}
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
            <div className="panel-card config-panel-card">
              <div className="panel-card-head">
                <div>
                  <h3>Parámetros del Salón</h3>
                  <span className="panel-card-subtitle">Políticas de reserva, señas requeridas, anticipación y reglas de atención</span>
                </div>
              </div>
              <form onSubmit={handleSaveSettings} className="settings-form">
                {/* Sección 1: Datos Generales */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h4>Identidad y Moneda</h4>
                    <p>Información básica visible para las clientas y facturación</p>
                  </div>
                  <div className="settings-grid">
                    <label className="field-group">
                      <span className="field-label">Nombre del Salón</span>
                      <input
                        required
                        className="field-input"
                        value={settingsForm.salonName}
                        onChange={(e) => setSettingsForm({ ...settingsForm, salonName: e.target.value })}
                        placeholder="Ej. Atelier Beauty Studio"
                      />
                    </label>
                    <label className="field-group">
                      <span className="field-label">Moneda Oficial</span>
                      <input
                        required
                        className="field-input"
                        value={settingsForm.currency}
                        onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                        placeholder="ARS"
                      />
                    </label>
                  </div>
                </div>

                {/* Sección 2: Señas y Cancelaciones */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h4>Políticas de Reserva y Señas</h4>
                    <p>Condiciones comerciales para asegurar los turnos solicitados</p>
                  </div>
                  <div className="settings-grid">
                    <label className="field-group">
                      <span className="field-label">Porcentaje de Seña por Defecto (%)</span>
                      <input
                        type="number"
                        required
                        min="0"
                        max="100"
                        className="field-input"
                        value={settingsForm.defaultDepositPercentage}
                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultDepositPercentage: Number(e.target.value) })}
                      />
                      <small className="field-helper">Porcentaje sugerido al agendar nuevos servicios</small>
                    </label>
                    <label className="field-group">
                      <span className="field-label">Anticipación mínima para cancelar (horas)</span>
                      <input
                        type="number"
                        required
                        min="1"
                        className="field-input"
                        value={settingsForm.minCancelHoursNotice}
                        onChange={(e) => setSettingsForm({ ...settingsForm, minCancelHoursNotice: Number(e.target.value) })}
                      />
                      <small className="field-helper">Margen de aviso para no penalizar la seña</small>
                    </label>
                  </div>
                </div>

                {/* Sección 3: Horarios de Atención */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h4>Horarios de Atención</h4>
                    <p>Franja horaria para asignación de turnos y agenda online</p>
                  </div>
                  <div className="settings-grid">
                    <label className="field-group">
                      <span className="field-label">Horario de Apertura</span>
                      <input
                        type="time"
                        className="field-input"
                        value={settingsForm.businessHoursStart}
                        onChange={(e) => setSettingsForm({ ...settingsForm, businessHoursStart: e.target.value })}
                      />
                    </label>
                    <label className="field-group">
                      <span className="field-label">Horario de Cierre</span>
                      <input
                        type="time"
                        className="field-input"
                        value={settingsForm.businessHoursEnd}
                        onChange={(e) => setSettingsForm({ ...settingsForm, businessHoursEnd: e.target.value })}
                      />
                    </label>
                  </div>
                </div>

                {/* Sección 4: Reglas y Checklist */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h4>Reglas de Agendamiento Online</h4>
                    <p>Comportamiento automático para el portal público</p>
                  </div>
                  <div className="settings-checklist-grid">
                    <label className="checklist-card">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={settingsForm.autoConfirmPublicBookings}
                        onChange={(e) => setSettingsForm({ ...settingsForm, autoConfirmPublicBookings: e.target.checked })}
                      />
                      <div className="checklist-card-info">
                        <b>Confirmar automáticamente reservas online</b>
                        <p>Los turnos tomados desde el portal web quedan confirmados sin requerir visto bueno manual.</p>
                      </div>
                    </label>
                    <label className="checklist-card">
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={settingsForm.allowSimultaneousServices}
                        onChange={(e) => setSettingsForm({ ...settingsForm, allowSimultaneousServices: e.target.checked })}
                      />
                      <div className="checklist-card-info">
                        <b>Habilitar servicios simultáneos</b>
                        <p>Permite agendar turnos superpuestos con diferentes profesionales en el mismo horario.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Sección 5: Textos de Políticas */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <h4>Texto de Políticas al Cliente</h4>
                    <p>Mensaje que figurará en el comprobante y portal público de reserva</p>
                  </div>
                  <label className="field-group">
                    <textarea
                      rows={3}
                      className="field-textarea"
                      value={settingsForm.cancellationPolicyText}
                      onChange={(e) => setSettingsForm({ ...settingsForm, cancellationPolicyText: e.target.value })}
                      placeholder="Ej. Cancelaciones con al menos 24 hs de anticipación para conservar la seña..."
                    />
                  </label>
                </div>

                <div className="settings-footer">
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-new-apt" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 id="modal-title-new-apt">Crear Nuevo Turno Interno</h3>
                <span className="modal-subtitle">Asigná fecha, servicio, clienta y condiciones de pago</span>
              </div>
              <button className="icon-btn" onClick={() => setShowNewAppointmentModal(false)} aria-label="Cerrar modal">
                <X size={18} />
              </button>
            </div>
            {formError && <p className="error-copy nav-badge summary-banner btn-cancel agenda-item-card">{formError}</p>}
            <form onSubmit={handleCreateInternalAppointment} className="modern-form">
              <div className="form-toggle-segment" role="group" aria-label="Tipo de clienta">
                <button
                  type="button"
                  className={`segment-btn ${formClientMode === 'existing' ? 'active' : ''}`}
                  onClick={() => setFormClientMode('existing')}
                >
                  Clienta Existente
                </button>
                <button
                  type="button"
                  className={`segment-btn ${formClientMode === 'new' ? 'active' : ''}`}
                  onClick={() => setFormClientMode('new')}
                >
                  Nueva Clienta
                </button>
              </div>

              {formClientMode === 'existing' ? (
                <label className="field-group">
                  <span className="field-label">Seleccionar Clienta</span>
                  <select
                    className="field-input field-select"
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Seleccionar de la lista --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="input-row">
                  <label className="field-group">
                    <span className="field-label">Nombre y Apellido</span>
                    <input
                      required
                      className="field-input"
                      value={formClientName}
                      onChange={(e) => setFormClientName(e.target.value)}
                      placeholder="Ej. Valentina Ramos"
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Teléfono / WhatsApp</span>
                    <input
                      required
                      className="field-input"
                      value={formClientPhone}
                      onChange={(e) => setFormClientPhone(e.target.value)}
                      placeholder="11 5555 1234"
                    />
                  </label>
                </div>
              )}

              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Servicio</span>
                  <select
                    className="field-input field-select"
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

                <label className="field-group">
                  <span className="field-label">Profesional Responsable</span>
                  <select
                    className="field-input field-select"
                    value={formProId}
                    onChange={(e) => setFormProId(e.target.value)}
                    required
                  >
                    {initialData.professionals.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Fecha del Turno</span>
                  <input
                    type="date"
                    className="field-input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">Horario</span>
                  <input
                    type="time"
                    className="field-input"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Seña Inicial (ARS)</span>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={formDepositAmount}
                    onChange={(e) => setFormDepositAmount(e.target.value)}
                    placeholder="0"
                  />
                  <small className="field-helper">Monto cobrado al agendar</small>
                </label>
                <label className="field-group">
                  <span className="field-label">Medio de Pago Seña</span>
                  <select
                    className="field-input field-select"
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                  <small className="field-helper">Canal de recepción del pago</small>
                </label>
              </div>

              <label className="field-group">
                <span className="field-label">Observaciones y Preferencias</span>
                <textarea
                  rows={2}
                  className="field-textarea"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Detalles sobre diseño, requerimientos especiales o alergias"
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-payment" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 id="modal-title-payment">Registrar Pago / Seña</h3>
                <span className="modal-subtitle">Asentá cobros totales, parciales o señas del turno</span>
              </div>
              <button className="icon-btn" onClick={() => setShowPaymentModal(null)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <div className="payment-target-card">
              <div className="payment-target-item">
                <span className="payment-target-label">Servicio</span>
                <span className="payment-target-val">{showPaymentModal.serviceName}</span>
              </div>
              <div className="payment-target-item">
                <span className="payment-target-label">Clienta</span>
                <span className="payment-target-val">{showPaymentModal.clientName}</span>
              </div>
              <div className="payment-target-item highlight">
                <span className="payment-target-label">Total a abonar</span>
                <span className="payment-target-val">${Number(showPaymentModal.totalPrice).toLocaleString('es-AR')} ARS</span>
              </div>
            </div>
            <form onSubmit={handleRegisterPayment} className="modern-form">
              <label className="field-group">
                <span className="field-label">Importe a registrar (ARS)</span>
                <input
                  type="number"
                  required
                  min="1"
                  className="field-input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ej. 10000"
                />
              </label>
              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Tipo de Operación</span>
                  <select
                    className="field-input field-select"
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                  >
                    <option value="deposit">Seña</option>
                    <option value="partial">Pago parcial</option>
                    <option value="full">Pago total</option>
                    <option value="refund">Reembolso / Devolución</option>
                  </select>
                </label>
                <label className="field-group">
                  <span className="field-label">Medio de Pago</span>
                  <select
                    className="field-input field-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </label>
              </div>
              <label className="field-group">
                <span className="field-label">Comprobante o Detalle (opcional)</span>
                <input
                  className="field-input"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Nro comprobante / Referencia / Observación"
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-reschedule" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 id="modal-title-reschedule">Reprogramar Turno</h3>
                <span className="modal-subtitle">Modificá la fecha y horario asignados a este turno</span>
              </div>
              <button className="icon-btn" onClick={() => setShowRescheduleModal(null)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <div className="reschedule-context-card">
              <span className="reschedule-client">{showRescheduleModal.clientName}</span>
              <span className="reschedule-service">{showRescheduleModal.serviceName} · {showRescheduleModal.professional}</span>
            </div>
            <form onSubmit={handleConfirmReschedule} className="modern-form">
              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Nueva Fecha</span>
                  <input
                    type="date"
                    required
                    className="field-input"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">Nuevo Horario</span>
                  <input
                    type="time"
                    required
                    className="field-input"
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-cancel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3 id="modal-title-cancel">Cancelar Turno</h3>
                <span className="modal-subtitle">Esta acción registrará la anulación del turno en la agenda</span>
              </div>
              <button className="icon-btn" onClick={() => setShowCancelModal(null)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <div className="cancel-notice-box">
              <p>¿Estás seguro de cancelar el turno de <strong>{showCancelModal.clientName}</strong> para <em>{showCancelModal.serviceName}</em>?</p>
            </div>
            <form onSubmit={handleConfirmCancel} className="modern-form">
              <label className="field-group">
                <span className="field-label">Motivo de cancelación</span>
                <textarea
                  required
                  rows={2}
                  className="field-textarea"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Detallar causa de cancelación..."
                />
                <small className="field-helper">Quedará asentado en el historial del turno</small>
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-client" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="modal-title-client">{clientForm.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button className="icon-btn" onClick={() => setShowClientModal(false)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveClient} className="modern-form">
              <label className="field-group">
                <span className="field-label">Nombre Completo</span>
                <input
                  required
                  className="field-input"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                  placeholder="Ej. Sofía Martínez"
                />
              </label>
              <div className="input-row">
                <label className="field-group">
                  <span className="field-label">Teléfono / WhatsApp</span>
                  <input
                    required
                    className="field-input"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    placeholder="11 5555 0182"
                  />
                </label>
                <label className="field-group">
                  <span className="field-label">Email (opcional)</span>
                  <input
                    type="email"
                    className="field-input"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    placeholder="sofia@ejemplo.com"
                  />
                </label>
              </div>
              <label className="field-group">
                <span className="field-label">Observaciones y Preferencias (opcional)</span>
                <textarea
                  rows={2}
                  className="field-textarea"
                  value={clientForm.notes}
                  onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                  placeholder="Alergias, preferencias o detalles de la clienta..."
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-service" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="modal-title-service">{serviceForm.id ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
              <button className="icon-btn" onClick={() => setShowServiceModal(null)} aria-label="Cerrar modal"><X size={18} /></button>
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
      {/* Modal ABM de Turnos y Horarios de Atención por Profesional */}
      {isSchedulesModalOpen && selectedProForSchedules && (
        <div className="modal-backdrop" onClick={() => setIsSchedulesModalOpen(false)}>
          <div
            className="modal-box modal-box-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title-sched"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3 id="modal-title-sched">Turnos y Horarios de Atención</h3>
                <p className="modal-subtitle">
                  Configuración de días, franjas horarias y descansos para <b>{selectedProForSchedules.name}</b>
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => setIsSchedulesModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sched-modal-content">
              {/* Tabla de horarios semanales */}
              <div className="sched-table-container">
                <table className="sched-table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      <th>Estado</th>
                      <th>Horario de Atención</th>
                      <th>Pausa / Descanso</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { num: 1, name: 'Lunes' },
                      { num: 2, name: 'Martes' },
                      { num: 3, name: 'Miércoles' },
                      { num: 4, name: 'Jueves' },
                      { num: 5, name: 'Viernes' },
                      { num: 6, name: 'Sábado' },
                      { num: 0, name: 'Domingo' },
                    ].map((d) => {
                      const item = schedules.find(
                        (s) => s.professionalId === selectedProForSchedules.id && s.dayOfWeek === d.num
                      )

                      return (
                        <tr key={d.num} className={item?.isActive ? 'row-active' : 'row-inactive'}>
                          <td className="font-semibold text-color-main">{d.name}</td>
                          <td>
                            {item ? (
                              <button
                                type="button"
                                className={`sched-toggle-btn ${item.isActive ? 'btn-active' : 'btn-inactive'}`}
                                onClick={() => handleToggleSchedule(item.id)}
                              >
                                {item.isActive ? <Check size={14} /> : <Ban size={14} />}
                                <span>{item.isActive ? 'Atiende' : 'Franco'}</span>
                              </button>
                            ) : (
                              <span className="sched-empty-badge">Sin horario</span>
                            )}
                          </td>
                          <td>
                            {item ? (
                              <div className="sched-time-inputs">
                                <span className="text-xs text-neutral-400">Desde</span>
                                <input
                                  type="time"
                                  className="sched-inline-input"
                                  defaultValue={item.startTime}
                                  onBlur={(e) => {
                                    if (e.target.value !== item.startTime) {
                                      handleUpdateScheduleRow(item, 'startTime', e.target.value)
                                    }
                                  }}
                                />
                                <span className="text-xs text-neutral-400">Hasta</span>
                                <input
                                  type="time"
                                  className="sched-inline-input"
                                  defaultValue={item.endTime}
                                  onBlur={(e) => {
                                    if (e.target.value !== item.endTime) {
                                      handleUpdateScheduleRow(item, 'endTime', e.target.value)
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-xs italic text-neutral-400">Sin franja asignada (Franco)</span>
                            )}
                          </td>
                          <td>
                            {item && (
                              <div className="sched-time-inputs">
                                <span className="text-xs text-neutral-400">Pausa</span>
                                <input
                                  type="time"
                                  className="sched-inline-input"
                                  defaultValue={item.breakStartTime || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (item.breakStartTime || '')) {
                                      handleUpdateScheduleRow(item, 'breakStartTime', e.target.value || null)
                                    }
                                  }}
                                />
                                <span className="text-xs text-neutral-400">a</span>
                                <input
                                  type="time"
                                  className="sched-inline-input"
                                  defaultValue={item.breakEndTime || ''}
                                  onBlur={(e) => {
                                    if (e.target.value !== (item.breakEndTime || '')) {
                                      handleUpdateScheduleRow(item, 'breakEndTime', e.target.value || null)
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td>
                            {item && (
                              <button
                                type="button"
                                className="icon-btn-danger"
                                title="Eliminar este horario"
                                onClick={() => handleDeleteSchedule(item.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Formulario rápido para agregar o restablecer horario */}
              <div className="sched-quick-add">
                <h4>Agregar o restablecer día de atención</h4>
                <form onSubmit={handleSaveSchedule} className="sched-form">
                  <div className="sched-form-row">
                    <div className="sched-form-field">
                      <label>Día</label>
                      <select name="dayOfWeek" defaultValue="1" required className="sched-select">
                        <option value="1">Lunes</option>
                        <option value="2">Martes</option>
                        <option value="3">Miércoles</option>
                        <option value="4">Jueves</option>
                        <option value="5">Viernes</option>
                        <option value="6">Sábado</option>
                        <option value="0">Domingo</option>
                      </select>
                    </div>

                    <div className="sched-form-field">
                      <label>Hora Inicio</label>
                      <input type="time" name="startTime" defaultValue="09:00" required className="sched-input" />
                    </div>

                    <div className="sched-form-field">
                      <label>Hora Fin</label>
                      <input type="time" name="endTime" defaultValue="18:00" required className="sched-input" />
                    </div>

                    <div className="sched-form-field">
                      <label>Descanso Inicio</label>
                      <input type="time" name="breakStartTime" defaultValue="13:00" className="sched-input" />
                    </div>

                    <div className="sched-form-field">
                      <label>Descanso Fin</label>
                      <input type="time" name="breakEndTime" defaultValue="14:00" className="sched-input" />
                    </div>

                    <div className="sched-form-field sched-submit-field">
                      <button type="submit" className="btn-primary-compact">
                        <Plus size={15} /> Guardar
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="modal-actions">
              <div className="sched-toggle-btn sched-submit-field"> 
                <button
                  type="button"
                  className="btn-primary-compact"
                  onClick={() => setIsSchedulesModalOpen(false)}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfessionalModal && (
        <div className="modal-backdrop" onClick={() => setShowProfessionalModal(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-pro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="modal-title-pro">{proForm.id ? 'Editar Profesional' : 'Nueva Profesional'}</h3>
              <button className="icon-btn" onClick={() => setShowProfessionalModal(null)} aria-label="Cerrar modal"><X size={18} /></button>
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
          <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title-inventory" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="modal-title-inventory">Registrar Movimiento de Material</h3>
              <button className="icon-btn" onClick={() => setShowInventoryModal(false)} aria-label="Cerrar modal"><X size={18} /></button>
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
