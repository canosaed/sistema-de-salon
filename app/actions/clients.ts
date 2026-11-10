'use server'

import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clients } from '@/lib/db/schema'
import { requireSalonRole } from '@/lib/staff-auth'

export async function getClients() {
  await requireSalonRole()
  return db.select({ id: clients.id, name: clients.name, phone: clients.phone, visits: clients.visits })
    .from(clients)
    .where(eq(clients.isActive, true))
    .orderBy(asc(clients.name))
}

export async function updateClient(input: { id: string; name: string; phone: string; email?: string; notes?: string }) {
  await requireSalonRole()

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name || !phone) throw new Error('Missing required client fields')

  const [updatedClient] = await db.update(clients).set({ name, phone, email: input.email?.trim() || null, notes: input.notes?.trim() || null, updatedAt: new Date() }).where(eq(clients.id, input.id)).returning({ id: clients.id, name: clients.name, phone: clients.phone, visits: clients.visits })
  if (!updatedClient) throw new Error('Client not found')
  return updatedClient
}

export async function deleteClient(clientId: string) {
  await requireSalonRole()
  const [deletedClient] = await db.update(clients).set({ isActive: false, updatedAt: new Date() }).where(eq(clients.id, clientId)).returning({ id: clients.id })
  if (!deletedClient) throw new Error('Client not found')
}

export async function createClient(input: { name: string; phone: string; email?: string; notes?: string }) {
  const sessionUser = await requireSalonRole()

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name || !phone) throw new Error('Missing required client fields')

  const client = {
    id: crypto.randomUUID(),
    userId: sessionUser.id,
    name,
    phone,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    visits: 0,
  }

  await db.insert(clients).values(client)
  return client
}
