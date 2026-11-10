import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'

loadEnvConfig(process.cwd())

async function main() {
  const action = process.argv[2]
  const runId = process.argv[3] ?? randomUUID()
  const connectionString = process.env.DATABASE_URL
  if (process.env.SALON_RUN_DB_TESTS !== '1') {
    throw new Error('Set SALON_RUN_DB_TESTS=1 to manage temporary E2E fixtures.')
  }
  if (!connectionString) throw new Error('DATABASE_URL is required.')

  const connectionUrl = new URL(connectionString)
  if (!['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname)) {
    throw new Error('E2E fixtures are restricted to a local PostgreSQL server.')
  }
  if (!/^[\da-f-]{36}$/i.test(runId)) throw new Error('A valid fixture run ID is required.')

  const client = new Client({ connectionString })
  const clientPhone = `999${runId.replaceAll('-', '').slice(0, 10)}`
  await client.connect()
  try {
    if (action === 'setup') {
      const owner = await client.query<{ id: string }>(
        'SELECT id FROM "user" ORDER BY "createdAt" LIMIT 1',
      )
      if (!owner.rows[0]) throw new Error('E2E setup requires an existing salon owner account.')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(tomorrow)
      const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]))
      const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`
      const [year, month, day] = date.split('-').map(Number)
      const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

      await client.query('BEGIN')
      try {
        await client.query(`
          INSERT INTO service_category (id, name, slug, "order")
          VALUES ($1, 'E2E QA', $2, 999)
        `, [runId, `e2e-${runId}`])
        await client.query(`
          INSERT INTO professional (id, name, phone, initials, "isActive")
          VALUES ($1, 'E2E QA', $2, 'QA', true)
        `, [runId, clientPhone])
        await client.query(`
          INSERT INTO service (
            id, "categoryId", name, description, price, "durationMinutes",
            "prepMinutes", "cleanupMinutes", "depositType", "depositValue",
            "allowPublicBooking", "isActive"
          ) VALUES ($1, $2, $3, 'Temporal E2E test service', 1000, 30, 0, 0, 'fixed', 100, true, true)
        `, [runId, runId, `E2E test ${runId.slice(0, 8)}`])
        await client.query(`
          INSERT INTO professional_service (id, "professionalId", "serviceId")
          VALUES ($1, $2, $3)
        `, [runId, runId, runId])
        await client.query(`
          INSERT INTO professional_schedule (
            id, "professionalId", "dayOfWeek", "startTime", "endTime", "isActive"
          ) VALUES ($1, $2, $3, '09:00', '17:00', true)
        `, [runId, runId, dayOfWeek])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }

      console.log(JSON.stringify({
        runId,
        date,
        serviceName: `E2E test ${runId.slice(0, 8)}`,
        clientPhone,
      }))
      return
    }

    if (action !== 'cleanup') throw new Error('Use setup or cleanup <runId>.')
    await client.query('BEGIN')
    try {
      await client.query(`
        DELETE FROM payment
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [clientPhone])
      await client.query(`
        DELETE FROM appointment_history
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [clientPhone])
      await client.query(`
        DELETE FROM appointment_service
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [clientPhone])
      await client.query(`
        DELETE FROM appointment
        WHERE "clientId" IN (SELECT id FROM client WHERE phone = $1)
      `, [clientPhone])
      await client.query('DELETE FROM client WHERE phone = $1', [clientPhone])
      await client.query('DELETE FROM professional_schedule WHERE id = $1', [runId])
      await client.query('DELETE FROM professional_service WHERE id = $1', [runId])
      await client.query('DELETE FROM service WHERE id = $1', [runId])
      await client.query('DELETE FROM professional WHERE id = $1', [runId])
      await client.query('DELETE FROM service_category WHERE id = $1', [runId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    console.log(`Removed temporary E2E fixture ${runId}.`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'E2E fixture operation failed.')
  process.exitCode = 1
})
