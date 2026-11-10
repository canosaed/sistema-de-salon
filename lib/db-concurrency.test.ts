import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'
import test from 'node:test'

loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL
const runDatabaseTests = process.env.SALON_RUN_DB_TESTS === '1'

test('PostgreSQL rejects concurrent overlapping appointments', { timeout: 15_000 }, async () => {
  assert.ok(runDatabaseTests, 'Set SALON_RUN_DB_TESTS=1 to run database tests.')
  assert.ok(connectionString, 'DATABASE_URL is required for database tests.')

  const connectionUrl = new URL(connectionString)
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname),
    'Database tests are restricted to a local PostgreSQL server.',
  )

  const first = new Client({ connectionString })
  const second = new Client({ connectionString })
  const observer = new Client({ connectionString })
  const firstAppointmentId = randomUUID()
  const secondAppointmentId = randomUUID()
  const professionalId = randomUUID()
  let firstCommitted = false
  let secondTransactionStarted = false
  let secondAttempt: Promise<void> | undefined

  async function insertAppointment(client: Client, id: string, start: string, end: string) {
    await client.query(`
      INSERT INTO appointment (
        id, "clientId", "professionalId", "startDateTime", "endDateTime",
        "totalDurationMinutes", "totalPrice", status, "paymentStatus"
      ) VALUES ($1, $2, $3, $4, $5, 45, 1000, 'confirmed', 'pending')
    `, [id, randomUUID(), professionalId, start, end])
  }

  try {
    await Promise.all([first.connect(), second.connect(), observer.connect()])
    const guard = await observer.query<{ triggerExists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'appointment_prevent_overlap' AND NOT tgisinternal
      ) AS "triggerExists"
    `)
    assert.equal(guard.rows[0]?.triggerExists, true, 'Overlap trigger migration must be applied.')

    await first.query('BEGIN')
    await second.query('BEGIN')
    secondTransactionStarted = true
    await insertAppointment(first, firstAppointmentId, '2035-05-01 10:00:00', '2035-05-01 10:45:00')
    const backend = await second.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    secondAttempt = insertAppointment(
      second,
      secondAppointmentId,
      '2035-05-01 10:30:00',
      '2035-05-01 11:15:00',
    )

    let waitingForAdvisoryLock = false
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      const state = await observer.query<{ waiting: boolean }>(`
        SELECT wait_event_type = 'Lock' AS waiting
        FROM pg_stat_activity
        WHERE pid = $1
      `, [backend.rows[0]?.pid])
      if (state.rows[0]?.waiting) {
        waitingForAdvisoryLock = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.equal(waitingForAdvisoryLock, true, 'Second booking should wait for the per-professional lock.')

    await first.query('COMMIT')
    firstCommitted = true
    await assert.rejects(secondAttempt, (error: unknown) =>
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01',
    )
    await second.query('ROLLBACK')
    secondTransactionStarted = false
  } finally {
    if (secondTransactionStarted) {
      await secondAttempt?.catch(() => undefined)
      await second.query('ROLLBACK').catch(() => undefined)
    }
    if (!firstCommitted) await first.query('ROLLBACK').catch(() => undefined)
    if (firstCommitted) {
      await observer.query('DELETE FROM appointment WHERE id = $1', [firstAppointmentId])
    }
    await Promise.all([first.end(), second.end(), observer.end()])
  }
})
