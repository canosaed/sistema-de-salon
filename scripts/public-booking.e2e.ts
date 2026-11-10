import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { chromium } from 'playwright'
import { Client } from 'pg'

loadEnvConfig(process.cwd())

function salonDate(daysAhead: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysAhead)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function main() {
  if (process.env.SALON_RUN_DB_TESTS !== '1') {
    throw new Error('Set SALON_RUN_DB_TESTS=1 to run public booking E2E tests.')
  }
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required.')
  const databaseUrl = new URL(connectionString)
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('Public booking E2E tests are restricted to a local PostgreSQL server.')
  }
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3000'
  const appUrl = new URL(baseUrl)
  if (!['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)) {
    throw new Error('The public booking E2E app URL must be local.')
  }

  const db = new Client({ connectionString })
  const runId = randomUUID()
  const fixture = {
    categoryId: randomUUID(),
    professionalId: randomUUID(),
    serviceId: randomUUID(),
    professionalServiceId: randomUUID(),
    scheduleId: randomUUID(),
    clientPhone: `996${runId.replaceAll('-', '').slice(0, 10)}`,
    serviceName: `Browser E2E ${runId.slice(0, 8)}`,
  }
  let date = ''
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

  async function cleanup() {
    await db.query('BEGIN')
    try {
      await db.query(`
        DELETE FROM payment
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [fixture.clientPhone])
      await db.query(`
        DELETE FROM appointment_history
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [fixture.clientPhone])
      await db.query(`
        DELETE FROM appointment_service
        WHERE "appointmentId" IN (
          SELECT a.id FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE c.phone = $1
        )
      `, [fixture.clientPhone])
      await db.query(`
        DELETE FROM appointment
        WHERE "clientId" IN (SELECT id FROM client WHERE phone = $1)
      `, [fixture.clientPhone])
      await db.query('DELETE FROM client WHERE phone = $1', [fixture.clientPhone])
      await db.query('DELETE FROM professional_schedule WHERE id = $1', [fixture.scheduleId])
      await db.query('DELETE FROM professional_service WHERE id = $1', [fixture.professionalServiceId])
      await db.query('DELETE FROM service WHERE id = $1', [fixture.serviceId])
      await db.query('DELETE FROM professional WHERE id = $1', [fixture.professionalId])
      await db.query('DELETE FROM service_category WHERE id = $1', [fixture.categoryId])
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  }

  await db.connect()
  try {
    const owner = await db.query<{ id: string }>('SELECT id FROM "user" LIMIT 1')
    assert.ok(owner.rows[0], 'Public booking E2E requires a configured salon account.')
    const settings = await db.query<{ minNoticeHoursForBooking: number }>(
      'SELECT "minNoticeHoursForBooking" FROM salon_setting LIMIT 1',
    )
    const daysAhead = Math.max(
      3,
      Math.ceil(Number(settings.rows[0]?.minNoticeHoursForBooking ?? 2) / 24) + 2,
    )
    date = salonDate(daysAhead)
    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay()

    await db.query('BEGIN')
    try {
      await db.query(`
        INSERT INTO service_category (id, name, slug, "order")
        VALUES ($1, 'Browser E2E', $2, 999)
      `, [fixture.categoryId, `browser-e2e-${runId}`])
      await db.query(`
        INSERT INTO professional (id, name, phone, initials, "isActive")
        VALUES ($1, $2, $3, 'QA', true)
      `, [fixture.professionalId, `E2E professional ${runId.slice(0, 8)}`, `${fixture.clientPhone}9`])
      await db.query(`
        INSERT INTO service (
          id, "categoryId", name, description, price, "durationMinutes",
          "prepMinutes", "cleanupMinutes", "depositType", "depositValue",
          "allowPublicBooking", "isActive"
        ) VALUES ($1, $2, $3, 'Temporary public booking E2E', 1800, 30, 0, 0, 'fixed', 200, true, true)
      `, [fixture.serviceId, fixture.categoryId, fixture.serviceName])
      await db.query(`
        INSERT INTO professional_service (id, "professionalId", "serviceId")
        VALUES ($1, $2, $3)
      `, [fixture.professionalServiceId, fixture.professionalId, fixture.serviceId])
      await db.query(`
        INSERT INTO professional_schedule (
          id, "professionalId", "dayOfWeek", "startTime", "endTime", "isActive"
        ) VALUES ($1, $2, $3, '09:00', '17:00', true)
      `, [fixture.scheduleId, fixture.professionalId, dayOfWeek])
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ timezoneId: 'America/Argentina/Buenos_Aires' })
    const page = await context.newPage()
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(new URL('/reservar', appUrl).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.getByRole('button', { name: 'Browser E2E', exact: true }).click()
    await page.locator('.service-booking-card').filter({ hasText: fixture.serviceName }).click()
    const professionalName = `E2E professional ${runId.slice(0, 8)}`
    const professionalGrid = page.locator('.pro-select-grid')
    await professionalGrid.waitFor()
    const professionalOptions = await professionalGrid.innerText()
    assert.ok(
      professionalOptions.includes(professionalName),
      `The public catalog did not render the test professional. Options: ${professionalOptions}`,
    )
    await page.getByRole('radio', { name: new RegExp(professionalName) }).click()
    await page.locator(`[data-date="${date}"]`).click()
    await page.getByRole('radio', { name: '09:00 hs' }).waitFor()
    await page.getByRole('radio', { name: '09:00 hs' }).click()
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.locator('#client-name').fill(`Browser E2E client ${runId.slice(0, 8)}`)
    await page.locator('#client-phone').fill(fixture.clientPhone)
    await page.locator('#client-email').fill(`browser-${runId}@example.invalid`)
    await page.getByRole('checkbox').click()
    await page.getByRole('button', { name: 'Confirmar Reserva' }).click()
    await page.getByRole('heading', { name: '¡Tu turno fue reservado con éxito!' }).waitFor()
    assert.deepEqual(pageErrors, [], 'The browser flow should complete without client-side exceptions.')
    const persisted = await db.query<{
      appointmentId: string
      status: string
      totalPrice: string
      deposit: string
      serviceCount: string
      historyCount: string
    }>(`
      SELECT a.id AS "appointmentId", a.status, a."totalPrice"::text AS "totalPrice",
        a."requiredDeposit"::text AS deposit,
        (SELECT count(*)::text FROM appointment_service s WHERE s."appointmentId" = a.id) AS "serviceCount",
        (SELECT count(*)::text FROM appointment_history h WHERE h."appointmentId" = a.id) AS "historyCount"
      FROM appointment a
      JOIN client c ON c.id = a."clientId"
      WHERE c.phone = $1
    `, [fixture.clientPhone])
    assert.equal(persisted.rows.length, 1)
    assert.equal(persisted.rows[0]?.status, 'pending_confirmation')
    assert.equal(persisted.rows[0]?.totalPrice, '1800.00')
    assert.equal(persisted.rows[0]?.deposit, '200.00')
    assert.equal(persisted.rows[0]?.serviceCount, '1')
    assert.equal(persisted.rows[0]?.historyCount, '1')
    await context.close()
    console.log(`Public booking browser E2E passed for ${date}; database rows and historical details were verified.`)
  } finally {
    await browser?.close()
    await cleanup()
    await db.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack || error.message : 'Public booking E2E failed.')
  process.exitCode = 1
})
