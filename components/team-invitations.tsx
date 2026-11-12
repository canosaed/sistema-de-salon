'use client'

import { useState } from 'react'
import {
  createTeamInvitation,
  setTeamUserPassword,
  setTeamUserActive,
  updateTeamUser,
} from '@/app/actions/team'

type TeamRole = 'admin' | 'receptionist' | 'professional'
type TeamUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: Date
}

const roles: { value: TeamRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'receptionist', label: 'Recepción' },
  { value: 'professional', label: 'Profesional' },
]

function roleLabel(role: string) {
  return roles.find((item) => item.value === role)?.label ?? role
}

export default function TeamInvitations({
  initialUsers,
  currentUserId,
}: {
  initialUsers: TeamUser[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [editValues, setEditValues] = useState<Record<string, { name: string; role: TeamRole }>>(
    Object.fromEntries(initialUsers.map((user) => [
      user.id,
      { name: user.name, role: user.role as TeamRole },
    ])),
  )
  const [email, setEmail] = useState('')
  const [passwordValues, setPasswordValues] = useState<Record<string, string>>({})
  const [inviteRole, setInviteRole] = useState<TeamRole>('receptionist')
  const [invitationUrl, setInvitationUrl] = useState('')
  const [message, setMessage] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  async function submitInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPendingAction('invite')
    setMessage('')
    setInvitationUrl('')
    try {
      const invitation = await createTeamInvitation({ email, role: inviteRole })
      setInvitationUrl(invitation.invitationUrl)
      setEmail('')
      setMessage(`Invitación de ${roleLabel(invitation.role)}. Vence el ${new Date(invitation.expiresAt).toLocaleString('es-AR')}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la invitación.')
    } finally {
      setPendingAction('')
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl)
      setMessage('Enlace copiado. Compartilo únicamente con la persona invitada.')
    } catch {
      setMessage('No se pudo copiar automáticamente. Seleccioná y copiá el enlace manualmente.')
    }
  }

  async function saveUser(account: TeamUser) {
    const values = editValues[account.id]
    if (!values) return
    setPendingAction(account.id)
    setMessage('')
    try {
      const updated = await updateTeamUser({ id: account.id, ...values })
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
      setEditValues((current) => ({
        ...current,
        [account.id]: { name: updated.name, role: updated.role as TeamRole },
      }))
      setMessage(`Se actualizaron los datos de ${updated.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la cuenta.')
    } finally {
      setPendingAction('')
    }
  }

  async function toggleUser(account: TeamUser) {
    setPendingAction(account.id)
    setMessage('')
    try {
      const updated = await setTeamUserActive({ id: account.id, isActive: !account.isActive })
      setUsers((current) => current.map((user) => user.id === updated.id ? updated : user))
      setMessage(updated.isActive
        ? `Se reactivó la cuenta de ${updated.name}.`
        : `Se bloqueó temporalmente la cuenta de ${updated.name} y se cerraron sus sesiones.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cambiar el estado de la cuenta.')
    } finally {
      setPendingAction('')
    }
  }

  async function changePassword(account: TeamUser) {
    const password = passwordValues[account.id] ?? ''
    setPendingAction(account.id)
    setMessage('')
    try {
      await setTeamUserPassword({ id: account.id, password })
      setPasswordValues((current) => ({ ...current, [account.id]: '' }))
      setMessage(`Se actualizó la contraseña de ${account.email} y se cerraron sus sesiones activas.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setPendingAction('')
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-8 text-[#262523] sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#927c60]">Atelier Gestión</p>
          <h1 className="mt-4 font-serif text-3xl tracking-[-0.04em] sm:text-4xl">Usuarios y equipo</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#77736d]">
            Administra cuentas y roles. El bloqueo es reversible y cierra las sesiones activas; no elimina datos ni historial.
          </p>
        </header>

        <section className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8">
          <h2 className="font-serif text-2xl tracking-[-0.03em]">Invitar usuario</h2>
          <p className="mt-2 text-sm leading-6 text-[#77736d]">
            La invitación es de un solo uso, corresponde al correo y vence en 24 horas. La persona define su contraseña al registrarse.
          </p>
          <form onSubmit={submitInvitation} className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
            <label className="grid gap-2 text-xs font-semibold">
              Correo electrónico
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
              />
            </label>
            <label className="grid gap-2 text-xs font-semibold">
              Rol inicial
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
              >
                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </label>
            <button
              disabled={pendingAction !== ''}
              className="h-12 rounded-xl bg-[#262523] px-6 text-sm font-semibold text-[#fffdf9] transition hover:bg-[#3d3a35] disabled:opacity-60"
            >
              {pendingAction === 'invite' ? 'Generando…' : 'Generar invitación'}
            </button>
          </form>
          {invitationUrl && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input readOnly value={invitationUrl} className="h-12 min-w-0 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm" />
              <button type="button" onClick={copyInvitation} className="h-12 rounded-xl border border-[#d8d4cc] px-5 text-sm font-semibold">
                Copiar enlace
              </button>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl tracking-[-0.03em]">Cuentas registradas</h2>
              <p className="mt-2 text-sm text-[#77736d]">{users.length} cuentas</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {users.map((account) => {
              const values = editValues[account.id] ?? { name: account.name, role: account.role as TeamRole }
              const busy = pendingAction === account.id
              return (
                <article key={account.id} className="grid gap-4 rounded-2xl border border-[#e5e1d9] bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold">{account.email}</p>
                      <p className="mt-1 text-xs text-[#77736d]">
                        Alta: {new Date(account.createdAt).toLocaleDateString('es-AR')}
                        {account.id === currentUserId ? ' · Tu cuenta' : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${account.isActive ? 'bg-[#e8f1e8] text-[#426947]' : 'bg-[#f8e9e5] text-[#9b4c40]'}`}>
                      {account.isActive ? 'Activa' : 'Bloqueada'}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto] sm:items-end">
                    <label className="grid gap-2 text-xs font-semibold">
                      Nombre
                      <input
                        maxLength={100}
                        value={values.name}
                        onChange={(event) => setEditValues((current) => ({
                          ...current,
                          [account.id]: { ...values, name: event.target.value },
                        }))}
                        className="h-11 rounded-xl border border-[#d8d4cc] px-3 text-sm outline-none focus:border-[#937b5d]"
                      />
                    </label>
                    
                    <label className="grid gap-2 text-xs font-semibold">
                      Rol
                      <select
                        value={values.role}
                        disabled={account.id === currentUserId}
                        onChange={(event) => setEditValues((current) => ({
                          ...current,
                          [account.id]: { ...values, role: event.target.value as TeamRole },
                        }))}
                        className="h-11 rounded-xl border border-[#d8d4cc] bg-white px-3 text-sm outline-none focus:border-[#937b5d] disabled:bg-[#f5f3ef]"
                      >
                        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={pendingAction !== '' || !account.isActive}
                      onClick={() => saveUser(account)}
                      className="h-11 rounded-xl bg-[#262523] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction !== '' || account.id === currentUserId}
                      onClick={() => toggleUser(account)}
                      className="h-11 rounded-xl border border-[#d8d4cc] px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      {busy ? 'Procesando…' : account.isActive ? 'Bloquear' : 'Reactivar'}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="grid gap-2 text-xs font-semibold">
                      Nueva contraseña
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={passwordValues[account.id] ?? ''}
                        onChange={(event) => setPasswordValues((current) => ({
                          ...current,
                          [account.id]: event.target.value,
                        }))}
                        placeholder="Mínimo 8 caracteres"
                        className="h-11 rounded-xl border border-[#d8d4cc] px-3 text-sm outline-none focus:border-[#937b5d]"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={pendingAction !== '' || (passwordValues[account.id] ?? '').length < 8}
                      onClick={() => changePassword(account)}
                      className="h-11 rounded-xl border border-[#d8d4cc] px-4 text-sm font-semibold disabled:opacity-50"
                    >
                      {busy ? 'Actualizando…' : 'Cambiar contraseña'}
                    </button>
                  </div>
                  {account.id === currentUserId && (
                    <p className="text-xs leading-5 text-[#77736d]">No puedes cambiar el rol ni bloquear tu propia cuenta.</p>
                  )}
                  {!account.isActive && (
                    <p className="text-xs leading-5 text-[#9b4c40]">La cuenta está bloqueada. Reactívala antes de editar nombre o rol.</p>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {message && <p role="status" className="bg-[#fffdf9] bg-destructive/10 border border-[#dedbd3] btn-cancel cat-pill px-4 py-3 rounded-xl text-sm">{message}</p>}
        <a href="/" className="justify-self-start text-sm font-semibold text-[#8c7457] underline underline-offset-4">Volver al panel</a>
      </div>
    </main>
  )
}
