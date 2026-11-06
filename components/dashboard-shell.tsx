'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Scissors,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

const appointments = [
  { time: '09:00', client: 'Sofía Martínez', service: 'Esmaltado semipermanente', professional: 'Valentina R.', status: 'Confirmado', color: 'bg-[#e4c3b7]' },
  { time: '10:30', client: 'Camila Torres', service: 'Lifting de pestañas', professional: 'Lucía M.', status: 'Pendiente', color: 'bg-[#d8c8e8]' },
  { time: '12:00', client: 'Julieta Acosta', service: 'Soft gel + nail art', professional: 'Valentina R.', status: 'Confirmado', color: 'bg-[#bfd8d2]' },
  { time: '15:30', client: 'Martina López', service: 'Pedicuría tradicional', professional: 'Agustina P.', status: 'Pendiente', color: 'bg-[#ead5a8]' },
  { time: '17:00', client: 'Renata Gómez', service: 'Extensiones clásicas', professional: 'Lucía M.', status: 'Confirmado', color: 'bg-[#e4c3b7]' },
]

const services = [
  { name: 'Esmaltado semipermanente', category: 'Manos y uñas', duration: '1h 15m', price: '$18.500', tone: 'bg-[#e4c3b7]' },
  { name: 'Soft gel', category: 'Manos y uñas', duration: '2h', price: '$27.000', tone: 'bg-[#bfd8d2]' },
  { name: 'Lifting de pestañas', category: 'Pestañas', duration: '1h', price: '$22.000', tone: 'bg-[#d8c8e8]' },
  { name: 'Pedicuría tradicional', category: 'Pies', duration: '1h', price: '$15.000', tone: 'bg-[#ead5a8]' },
]

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof CalendarDays; label: string; value: string; detail: string; tone: string }) {
  return <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></div>
    <div><p className="eyebrow">{label}</p><p className="stat-value">{value}</p><p className="stat-detail">{detail}</p></div>
  </div>
}

export default function DashboardShell() {
  const [active, setActive] = useState('Resumen')
  const [showNew, setShowNew] = useState(false)
  const [query, setQuery] = useState('')
  const filteredServices = useMemo(() => services.filter((service) => service.name.toLowerCase().includes(query.toLowerCase())), [query])
  const nav = [
    { label: 'Resumen', icon: LayoutDashboard },
    { label: 'Agenda', icon: CalendarDays },
    { label: 'Clientes', icon: Users },
    { label: 'Servicios', icon: Scissors },
    { label: 'Profesionales', icon: Sparkles },
  ]

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>atelier</strong><span>beauty studio</span></div></div>
      <div className="salon-switcher"><div className="salon-avatar">A</div><div><b>Atelier Beauty</b><small>Salón principal</small></div><ChevronRight size={15} /></div>
      <nav className="side-nav" aria-label="Navegación principal">{nav.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => setActive(label)}><Icon size={18} />{label}{label === 'Agenda' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings2 size={18} />Configuración</button><div className="user-card"><div className="user-avatar">LM</div><div><b>Lucía Méndez</b><small>Administradora</small></div><MoreHorizontal size={16} /></div></div>
    </aside>
    <section className="main-content">
      <header className="topbar"><button className="mobile-menu" aria-label="Abrir menú"><Menu size={20} /></button><div><p className="breadcrumb">Atelier Beauty <span>/</span> {active}</p><h1>{active === 'Resumen' ? 'Buenos días, Lucía' : active}</h1></div><div className="top-actions"><div className="top-search"><Search size={17} /><input placeholder="Buscar cliente..." aria-label="Buscar cliente" /></div><button className="icon-button" aria-label="Abrir menú"><MoreHorizontal size={20} /></button><button className="profile-avatar">LM</button></div></header>
      <div className="content-wrap">
        {active === 'Resumen' && <>
          <div className="welcome-row"><div><p className="section-kicker">Miércoles, 14 de agosto de 2024</p><p className="muted">Este es el resumen de tu salón para hoy.</p></div><button className="primary-button" onClick={() => setShowNew(true)}><Plus size={18} />Nuevo turno</button></div>
          <div className="stats-grid"><StatCard icon={CalendarDays} label="Turnos de hoy" value="12" detail="+3 vs. miércoles pasado" tone="rose" /><StatCard icon={Clock3} label="Pendientes" value="4" detail="Requieren confirmación" tone="lilac" /><StatCard icon={Users} label="Clientes nuevos" value="8" detail="En los últimos 30 días" tone="mint" /><StatCard icon={DollarSign} label="Ingresos del mes" value="$684.200" detail="+12,8% vs. mes anterior" tone="gold" /></div>
          <div className="dashboard-grid"><section className="panel agenda-panel"><div className="panel-heading"><div><h2>Agenda de hoy</h2><p>Miércoles, 14 de agosto</p></div><button className="text-button" onClick={() => setActive('Agenda')}>Ver agenda <ChevronRight size={15} /></button></div><div className="appointments">{appointments.map((appointment) => <div className="appointment" key={appointment.time}><span className="appointment-time">{appointment.time}</span><span className={`appointment-marker ${appointment.color}`} /><div className="appointment-info"><b>{appointment.client}</b><span>{appointment.service} · {appointment.professional}</span></div><span className={appointment.status === 'Confirmado' ? 'status confirmed' : 'status pending'}>{appointment.status}</span><button className="more-button" aria-label={`Opciones para ${appointment.client}`}><MoreHorizontal size={17} /></button></div>)}</div></section><section className="panel revenue-panel"><div className="panel-heading"><div><h2>Ingresos</h2><p>Últimos 7 días</p></div><button className="select-button">Esta semana <ChevronRight size={15} /></button></div><div className="revenue-total"><strong>$148.200</strong><span>+8,4%</span></div><div className="chart" aria-label="Gráfico de ingresos de los últimos siete días"><div className="grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 420 150" preserveAspectRatio="none" role="img" aria-label="Tendencia ascendente de ingresos"><path d="M0 123 C32 116, 43 105, 70 111 S107 75, 137 91 S166 88, 195 98 S219 51, 247 67 S278 42, 308 54 S336 24, 360 36 S397 8, 420 18" fill="none" stroke="#b98272" strokeWidth="3" /><path d="M0 123 C32 116, 43 105, 70 111 S107 75, 137 91 S166 88, 195 98 S219 51, 247 67 S278 42, 308 54 S336 24, 360 36 S397 8, 420 18 V150 H0Z" fill="url(#fill)" opacity=".16" /><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#b98272" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs></svg></div><div className="chart-labels"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div></section></div>
          <section className="panel services-panel"><div className="panel-heading"><div><h2>Servicios más solicitados</h2><p>Agosto 2024</p></div><button className="text-button" onClick={() => setActive('Servicios')}>Ver servicios <ChevronRight size={15} /></button></div><div className="service-list">{services.slice(0, 3).map((service, index) => <div className="service-row" key={service.name}><span className="service-rank">0{index + 1}</span><span className={`service-color ${service.tone}`} /><div className="service-name"><b>{service.name}</b><span>{service.category}</span></div><div className="service-bar"><span style={{ width: `${[82, 64, 48][index]}%` }} /></div><strong>{[82, 64, 48][index]}%</strong></div>)}</div></section>
        </>}
        {active === 'Agenda' && <section className="full-panel panel"><div className="calendar-toolbar"><div><p className="section-kicker">Agenda semanal</p><h2>12 — 18 de agosto, 2024</h2></div><div className="calendar-actions"><button className="icon-button"><ChevronLeft size={18} /></button><button className="icon-button"><ChevronRight size={18} /></button><button className="primary-button" onClick={() => setShowNew(true)}><Plus size={18} />Nuevo turno</button></div></div><div className="week-grid">{['Lun 12','Mar 13','Mié 14','Jue 15','Vie 16','Sáb 17'].map((day, index) => <div className={index === 2 ? 'day-column today' : 'day-column'} key={day}><b>{day}</b><span>{index === 2 ? 'Hoy' : `${index + 9} turnos`}</span>{appointments.slice(index % 2, (index % 2) + 2).map((a) => <div className={`mini-event ${a.color}`} key={`${day}-${a.time}`}><b>{a.time}</b><span>{a.client}</span><small>{a.service}</small></div>)}</div>)}</div></section>}
        {active === 'Clientes' && <section className="full-panel panel"><div className="panel-heading"><div><p className="section-kicker">Base de clientes</p><h2>Clientes</h2><p>128 personas registradas</p></div><button className="primary-button"><Plus size={18} />Nuevo cliente</button></div><div className="client-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o teléfono..." /></div><div className="client-table">{['Sofía Martínez','Camila Torres','Julieta Acosta','Martina López','Renata Gómez'].filter((name) => name.toLowerCase().includes(query.toLowerCase())).map((name, i) => <div className="client-row" key={name}><div className="client-initial">{name.split(' ').map((word) => word[0]).join('')}</div><div><b>{name}</b><span>{['11 5555 0182','11 5555 0227','11 5555 0374','11 5555 0421','11 5555 0639'][i]}</span></div><span className="client-visits">{3 + i} visitas</span><button className="more-button"><MoreHorizontal size={17} /></button></div>)}</div></section>}
        {active === 'Servicios' && <section className="full-panel panel"><div className="panel-heading"><div><p className="section-kicker">Catálogo</p><h2>Servicios</h2><p>Configurá precios, duración y profesionales.</p></div><button className="primary-button"><Plus size={18} />Nuevo servicio</button></div><div className="service-cards">{filteredServices.map((service) => <div className="catalog-card" key={service.name}><div className={`catalog-icon ${service.tone}`}><Scissors size={18} /></div><div><b>{service.name}</b><span>{service.category}</span><small>{service.duration} · {service.price}</small></div><button className="more-button"><MoreHorizontal size={17} /></button></div>)}</div></section>}
        {active === 'Profesionales' && <section className="full-panel panel"><div className="panel-heading"><div><p className="section-kicker">Equipo</p><h2>Profesionales</h2><p>3 profesionales activas</p></div><button className="primary-button"><Plus size={18} />Agregar profesional</button></div><div className="professional-list">{[['Valentina R.','Manicuría y uñas','VR','8 turnos hoy'],['Lucía M.','Pestañas y cejas','LM','6 turnos hoy'],['Agustina P.','Pedicuría','AP','4 turnos hoy']].map(([name, specialty, initials, appointments]) => <div className="professional-row" key={name}><div className="professional-avatar">{initials}</div><div><b>{name}</b><span>{specialty}</span></div><span className="availability"><i />Disponible</span><strong>{appointments}</strong><button className="more-button"><MoreHorizontal size={17} /></button></div>)}</div></section>}
      </div>
    </section>
    {showNew && <div className="modal-backdrop" onClick={() => setShowNew(false)}><div className="new-appointment" role="dialog" aria-modal="true" aria-labelledby="new-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="section-kicker">Agenda</p><h2 id="new-title">Nuevo turno</h2></div><button className="icon-button" onClick={() => setShowNew(false)} aria-label="Cerrar"><X size={19} /></button></div><label>Cliente<input placeholder="Buscar o seleccionar cliente" /></label><label>Servicio<select defaultValue=""><option value="" disabled>Elegir servicio</option><option>Esmaltado semipermanente · $18.500</option><option>Soft gel · $27.000</option><option>Lifting de pestañas · $22.000</option></select></label><div className="form-row"><label>Fecha<input type="date" defaultValue="2024-08-14" /></label><label>Hora<select defaultValue="10:30"><option>09:00</option><option>10:30</option><option>12:00</option><option>15:30</option></select></label></div><label>Profesional<select defaultValue=""><option value="" disabled>Asignar profesional</option><option>Valentina R.</option><option>Lucía M.</option><option>Agustina P.</option></select></label><div className="modal-foot"><button className="secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="primary-button" onClick={() => setShowNew(false)}>Guardar turno</button></div></div></div>}
  </main>
}
