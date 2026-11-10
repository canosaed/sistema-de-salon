import { createHash, timingSafeEqual } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { salonInvitations, user } from '@/lib/db/schema'

const authHandlers = toNextJsHandler(auth)
export const GET = authHandlers.GET

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function tokenMatches(candidate: string, expected: string) {
  const left = Buffer.from(hashToken(candidate), 'hex')
  const right = Buffer.from(hashToken(expected), 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

async function releaseInvitation(tokenHash: string) {
  await db.update(salonInvitations)
    .set({ acceptedAt: null })
    .where(eq(salonInvitations.tokenHash, tokenHash))
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  if (url.pathname.endsWith('/sign-in/email')) {
    let email: string | undefined
    try {
      const body = await request.clone().json() as { email?: string }
      email = body.email?.trim().toLowerCase()
    } catch {
      return authHandlers.POST(request)
    }
    if (email) {
      const [account] = await db.select({ isActive: user.isActive })
        .from(user)
        .where(sql`lower(${user.email}) = ${email}`)
        .limit(1)
      if (account && !account.isActive) {
        return NextResponse.json(
          { message: 'No pudimos completar el acceso. Revisa tus datos e inténtalo de nuevo.' },
          { status: 401 },
        )
      }
    }
    return authHandlers.POST(request)
  }
  if (!url.pathname.endsWith('/sign-up/email')) return authHandlers.POST(request)

  let body: { email?: string }
  try {
    body = await request.clone().json()
  } catch {
    return NextResponse.json({ message: 'Invalid sign-up request.' }, { status: 400 })
  }
  const email = body.email?.trim().toLowerCase()
  const rawToken = request.headers.get('x-salon-registration-token')?.trim()
  if (!email || !rawToken) return NextResponse.json({ message: 'Se requiere una invitación válida.' }, { status: 403 })

  const tokenHash = hashToken(rawToken)
  const setupSecret = process.env.SALON_SETUP_TOKEN
  const isSetupToken = Boolean(setupSecret && setupSecret.length >= 32 && tokenMatches(rawToken, setupSecret))
  const now = new Date()
  const invitation = await db.transaction(async (tx) => {
    if (isSetupToken) {
      const [existingUser] = await tx.select({ id: user.id }).from(user).limit(1)
      if (existingUser) return undefined

      const expiresAt = new Date(now.getTime() + 10 * 60_000)
      const setupId = `initial-setup-${tokenHash.slice(0, 20)}`
      await tx.insert(salonInvitations).values({
        id: setupId,
        email,
        tokenHash,
        role: 'admin',
        expiresAt,
      }).onConflictDoNothing()
    }

    const [claimed] = await tx.update(salonInvitations)
      .set({ acceptedAt: sql`now()` })
      .where(and(
        eq(salonInvitations.tokenHash, tokenHash),
        eq(salonInvitations.email, email),
        isNull(salonInvitations.acceptedAt),
        gt(salonInvitations.expiresAt, sql`now()`),
      ))
      .returning({ id: salonInvitations.id, role: salonInvitations.role })
    return claimed
  })

  if (!invitation) {
    return NextResponse.json({ message: 'La invitación no existe, venció o ya fue utilizada.' }, { status: 403 })
  }

  const response = await authHandlers.POST(request)
  if (!response.ok) {
    await releaseInvitation(tokenHash)
    return response
  }

  const [createdUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (!createdUser) {
    await releaseInvitation(tokenHash)
    return NextResponse.json({ message: 'No se pudo completar la creación de la cuenta.' }, { status: 500 })
  }

  await db.transaction(async (tx) => {
    await tx.update(user).set({ role: invitation.role, updatedAt: new Date() }).where(eq(user.id, createdUser.id))
    await tx.update(salonInvitations)
      .set({ acceptedAt: sql`now()` })
      .where(eq(salonInvitations.tokenHash, tokenHash))
  })
  return response
}
