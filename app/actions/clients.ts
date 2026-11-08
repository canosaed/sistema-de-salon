'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'

export async function getClients() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  return db.select({ id: clients.id, name: clients.name, phone: clients.phone, visits: clients.visits }).from(clients).where(eq(clients.userId, session.user.id)).orderBy(asc(clients.name))
}

export async function updateClient(input: { id: string; name: string; phone: string; email?: string; notes?: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name || !phone) throw new Error('Missing required client fields')

  await db.update(clients).set({ name, phone, email: input.email?.trim() || null, notes: input.notes?.trim() || null, updatedAt: new Date() }).where(and(eq(clients.id, input.id), eq(clients.userId, session.user.id)))
  return { ...input, name, phone, visits: 0 }
}

export async function deleteClient(clientId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  await db.delete(clients).where(and(eq(clients.id, clientId), eq(clients.userId, session.user.id)))
}

export async function createClient(input: { name: string; phone: string; email?: string; notes?: string }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name || !phone) throw new Error('Missing required client fields')

  const client = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name,
    phone,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    visits: 0,
  }

  await db.insert(clients).values(client)
  return client
}
