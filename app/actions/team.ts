'use server'

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { salonInvitations, session, user } from '@/lib/db/schema'
import { adminRoles, requireSalonRole, type SalonRole } from '@/lib/staff-auth'

const salonRoles: readonly SalonRole[] = ['admin', 'receptionist', 'professional']
function assertSalonRole(role: string): asserts role is SalonRole {
  if (!salonRoles.includes(role as SalonRole)) throw new Error('Seleccioná un rol válido.')
}

async function lockUserManagement(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(724193, 680012)`)
}

async function assertActiveAdministrator(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  const [actor] = await tx.select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!actor?.isActive || actor.role !== 'admin') throw new Error('Forbidden')
}

async function assertAnotherActiveAdministrator(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const [admins] = await tx.select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.role, 'admin'), eq(user.isActive, true)))
  if ((admins?.count ?? 0) <= 1) throw new Error('No se puede dejar al salón sin administradores activos.')
}

export async function getTeamUsers() {
  await requireSalonRole(adminRoles)
  return db.select({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  }).from(user).orderBy(user.createdAt, user.name)
}

export async function createTeamInvitation(input: { email: string; role?: SalonRole }) {
  const sessionUser = await requireSalonRole(adminRoles)

  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresá un correo electrónico válido.')
  const role = input.role ?? 'receptionist'
  assertSalonRole(role)

  const [existingUser] = await db.select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`)
    .limit(1)
  if (existingUser) throw new Error('Ya existe una cuenta con ese correo electrónico.')

  const [pendingInvitation] = await db.select({ id: salonInvitations.id })
    .from(salonInvitations)
    .where(and(
      sql`lower(${salonInvitations.email}) = ${email}`,
      isNull(salonInvitations.acceptedAt),
      gt(salonInvitations.expiresAt, new Date()),
    ))
    .limit(1)
  if (pendingInvitation) throw new Error('Ya existe una invitación vigente para ese correo.')

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  const baseUrl = configuredUrl || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
  if (!baseUrl) throw new Error('Configurá NEXT_PUBLIC_APP_URL para generar enlaces de invitación.')
  const invitationUrl = new URL('/sign-up', baseUrl)

  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000)
  await db.insert(salonInvitations).values({
    id: crypto.randomUUID(),
    email,
    tokenHash,
    role,
    expiresAt,
    createdBy: sessionUser.id,
  })

  invitationUrl.hash = new URLSearchParams({ invitation_token: token }).toString()
  revalidatePath('/equipo')
  return { invitationUrl: invitationUrl.toString(), expiresAt: expiresAt.toISOString(), role }
}

export async function updateTeamUser(input: { id: string; name: string; role: SalonRole }) {
  const actor = await requireSalonRole(adminRoles)
  const name = input.name.trim()
  if (!input.id || !name || name.length > 100) {
    throw new Error('El nombre es obligatorio y no puede superar los 100 caracteres.')
  }
  assertSalonRole(input.role)

  const updated = await db.transaction(async (tx) => {
    await lockUserManagement(tx)
    await assertActiveAdministrator(tx, actor.id)
    const [target] = await tx.select({
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    }).from(user).where(eq(user.id, input.id)).limit(1)
    if (!target) throw new Error('La cuenta no existe.')

    if (target.id === actor.id && input.role !== 'admin') {
      throw new Error('No podés quitarte el rol de administrador.')
    }
    if (target.isActive && target.role === 'admin' && input.role !== 'admin') {
      await assertAnotherActiveAdministrator(tx)
    }

    const [result] = await tx.update(user)
      .set({ name, role: input.role, updatedAt: new Date() })
      .where(eq(user.id, target.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
    if (target.role !== input.role) {
      await tx.delete(session).where(eq(session.userId, target.id))
    }
    return result
  })

  revalidatePath('/equipo')
  revalidatePath('/')
  return updated
}

export async function setTeamUserActive(input: { id: string; isActive: boolean }) {
  const actor = await requireSalonRole(adminRoles)
  if (!input.id || typeof input.isActive !== 'boolean') throw new Error('Estado de cuenta inválido.')
  if (input.id === actor.id && !input.isActive) throw new Error('No podés bloquear tu propia cuenta.')

  const updated = await db.transaction(async (tx) => {
    await lockUserManagement(tx)
    await assertActiveAdministrator(tx, actor.id)
    const [target] = await tx.select({
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    }).from(user).where(eq(user.id, input.id)).limit(1)
    if (!target) throw new Error('La cuenta no existe.')

    if (!input.isActive && target.isActive && target.role === 'admin') {
      await assertAnotherActiveAdministrator(tx)
    }

    const [result] = await tx.update(user)
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where(eq(user.id, target.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      })
    if (!input.isActive) {
      await tx.delete(session).where(eq(session.userId, target.id))
    }
    return result
  })

  revalidatePath('/equipo')
  revalidatePath('/')
  return updated
}
