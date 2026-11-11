import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { chromium } from 'playwright'
import { Client } from 'pg'

loadEnvConfig(process.cwd())

const roles = ['admin', 'receptionist', 'professional'] as const
const runDatabaseTests = process.env.SALON_RUN_DB_TESTS === '1'

function salonDate(daysAhead: number) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60_000)
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
  assert.ok(runDatabaseTests, 'Set SALON_RUN_DB_TESTS=1 to run role E2E tests.')
  const connectionString = process.env.DATABASE_URL
  assert.ok(connectionString, 'DATABASE_URL is required for role E2E tests.')
  const databaseUrl = new URL(connectionString)
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname),
    'Role E2E tests are restricted to a local PostgreSQL server.',
  )

  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
  const base = new URL(baseUrl)
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(base.hostname), 'The app URL must be local.')
  const db = new Client({ connectionString })
  const runId = randomUUID()
  const actionClient = {
    id: randomUUID(),
    name: `HTTP action ${runId}`,
    phone: `995${runId.replaceAll('-', '').slice(0, 10)}`,
  }
  const actionFormClient = {
    name: `HTTP form ${runId}`,
    phone: `993${runId.replaceAll('-', '').slice(0, 10)}`,
  }
  const actionAppointmentId = randomUUID()
  const actionProfessionalId = randomUUID()
  const actionScheduleId = randomUUID()
  const managedUserId = `http-managed-${runId}`
  const managedUserEmail = `managed-${runId}@example.invalid`
  const managedInvitationEmail = `managed-invite-${runId}@example.invalid`
  const demoServiceName = `HTTP E2E Service ${runId}`
  const demoProfessionalName = `HTTP E2E Professional ${runId}`
  const demoProfessionalUpdatedName = `${demoProfessionalName} Updated`
  const demoMaterialName = `HTTP E2E Material ${runId}`
  const actionStartDateText = salonDate(2)
  const actionRescheduleDate = salonDate(5)
  const actionStartDate = new Date(`${actionStartDateText}T15:00:00.000Z`)
  const temporarySalonName = `HTTP E2E ${runId}`
  let originalSettings: { id: string; salonName: string; updatedAt: Date } | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  const accounts = roles.map((role) => {
    const token = randomBytes(32).toString('hex')
    return {
      role,
      email: `role-${role}-${runId}@example.invalid`,
      token,
      invitationId: `${runId}-${role}`,
      tokenHash: createHash('sha256').update(token).digest('hex'),
    }
  })

  async function cleanup() {
    await db.query('BEGIN')
    try {
      await db.query('DELETE FROM appointment_history WHERE "appointmentId" = $1', [actionAppointmentId])
      await db.query('DELETE FROM appointment_service WHERE "appointmentId" = $1', [actionAppointmentId])
      await db.query('DELETE FROM payment WHERE "appointmentId" = $1', [actionAppointmentId])
      await db.query('DELETE FROM appointment WHERE id = $1', [actionAppointmentId])
      await db.query('DELETE FROM client WHERE id = $1', [actionClient.id])
      await db.query('DELETE FROM client WHERE phone = $1', [actionFormClient.phone])
      await db.query('DELETE FROM salon_invitation WHERE email = $1', [managedInvitationEmail])
      await db.query('DELETE FROM session WHERE "userId" = $1', [managedUserId])
      await db.query('DELETE FROM account WHERE "userId" = $1', [managedUserId])
      await db.query('DELETE FROM "user" WHERE id = $1', [managedUserId])
      await db.query(`
        DELETE FROM inventory_movement
        WHERE "materialId" IN (SELECT id FROM material WHERE name = $1)
      `, [demoMaterialName])
      await db.query('DELETE FROM material WHERE name = $1', [demoMaterialName])
      await db.query('DELETE FROM service WHERE name = $1', [demoServiceName])
      await db.query(`
        DELETE FROM professional_schedule
        WHERE "professionalId" IN (
          SELECT id FROM professional WHERE name IN ($1, $2)
        )
      `, [demoProfessionalName, demoProfessionalUpdatedName])
      await db.query('DELETE FROM professional WHERE name IN ($1, $2)', [
        demoProfessionalName,
        demoProfessionalUpdatedName,
      ])
      await db.query('DELETE FROM professional_schedule WHERE id = $1', [actionScheduleId])
      await db.query('DELETE FROM professional WHERE id = $1', [actionProfessionalId])
      if (originalSettings) {
        await db.query(
          'UPDATE salon_setting SET "salonName" = $2, "updatedAt" = $3 WHERE id = $1',
          [originalSettings.id, originalSettings.salonName, originalSettings.updatedAt],
        )
      } else {
        await db.query('DELETE FROM salon_setting WHERE "salonName" = $1', [temporarySalonName])
      }
      for (const { role, email, invitationId } of accounts) {
        const users = await db.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [email])
        const userIds = users.rows.map(({ id }) => id)
        if (userIds.length) {
          await db.query('DELETE FROM session WHERE "userId" = ANY($1::text[])', [userIds])
          await db.query('DELETE FROM account WHERE "userId" = ANY($1::text[])', [userIds])
          await db.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [userIds])
        }
        await db.query('DELETE FROM salon_invitation WHERE id = $1', [invitationId])
      }
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  }

  await db.connect()
  try {
    const settingsResult = await db.query<{ id: string; salonName: string; updatedAt: Date }>(
      'SELECT id, "salonName", "updatedAt" FROM salon_setting LIMIT 1',
    )
    originalSettings = settingsResult.rows[0]

    await db.query(`
      INSERT INTO "user" (id, name, email, role, "isActive")
      VALUES ($1, 'Managed HTTP user', $2, 'receptionist', true)
    `, [managedUserId, managedUserEmail])
    await db.query(`
      INSERT INTO session (id, "userId", token, "expiresAt")
      VALUES ($1, $2, $3, now() + interval '1 day')
    `, [`http-managed-session-${runId}`, managedUserId, `http-managed-token-${runId}`])

    await db.query(`
      INSERT INTO professional (id, name, phone, "isActive")
      VALUES ($1, 'HTTP E2E Professional', $2, true)
    `, [actionProfessionalId, `994${runId.replaceAll('-', '').slice(0, 10)}`])
    await db.query(`
      INSERT INTO professional_schedule (id, "professionalId", "dayOfWeek", "startTime", "endTime", "isActive")
      VALUES ($1, $2, $3, '09:00', '17:00', true)
    `, [actionScheduleId, actionProfessionalId, new Date(`${actionRescheduleDate}T00:00:00.000Z`).getUTCDay()])
    await db.query(`
      INSERT INTO client (id, name, phone, visits, "isActive")
      VALUES ($1, $2, $3, 0, true)
    `, [actionClient.id, actionClient.name, actionClient.phone])
    await db.query(`
      INSERT INTO appointment (
        id, "clientId", "professionalId", "startDateTime", "endDateTime",
        "totalDurationMinutes", "totalPrice", "requiredDeposit", status, "paymentStatus"
      ) VALUES ($1, $2, $3, $4, $5, 60, 12000, 0, 'in_progress', 'pending')
    `, [
      actionAppointmentId,
      actionClient.id,
      actionProfessionalId,
      actionStartDate,
      new Date(actionStartDate.getTime() + 60 * 60_000),
    ])

    await db.query('BEGIN')
    try {
      for (const account of accounts) {
        await db.query(`
          INSERT INTO salon_invitation (id, email, "tokenHash", role, "expiresAt")
          VALUES ($1, $2, $3, $4, now() + interval '30 minutes')
        `, [account.invitationId, account.email, account.tokenHash, account.role])
      }
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

    for (const account of accounts) {
      const signup = await fetch(new URL('/api/auth/sign-up/email', base), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base.origin,
          'x-salon-registration-token': account.token,
        },
        body: JSON.stringify({
          email: account.email,
          password: randomBytes(18).toString('base64url'),
          name: `E2E ${account.role}`,
        }),
      })
      const signupBody = await signup.text()
      if (!signup.ok) {
        const invitationState = await db.query<{ exists: boolean; accepted: boolean | null; unexpired: boolean | null }>(`
          SELECT EXISTS (
            SELECT 1 FROM salon_invitation
            WHERE id = $1 AND email = $2 AND "tokenHash" = $3
          ) AS exists,
          (SELECT "acceptedAt" IS NOT NULL FROM salon_invitation WHERE id = $1) AS accepted,
          (SELECT "expiresAt" > now() FROM salon_invitation WHERE id = $1) AS unexpired
        `, [account.invitationId, account.email, account.tokenHash])
        throw new Error(
          `${account.role} signup failed with HTTP ${signup.status}: ${signupBody}; ` +
          `local invitation state: ${JSON.stringify(invitationState.rows[0])}`,
        )
      }
      const cookies = signup.headers.getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .filter(Boolean)
        .join('; ')
      assert.ok(cookies, `${account.role} registration should issue an authentication cookie.`)

      const response = await fetch(new URL('/', base), {
        headers: { cookie: cookies },
        redirect: 'manual',
      })
      if (account.role === 'professional') {
        assert.equal(response.status, 307, 'Professionals must be redirected away from the management panel.')
        assert.equal(response.headers.get('location'), '/no-access')
      } else {
        assert.equal(response.status, 200, `${account.role} should be able to load the panel.`)
        const html = await response.text()
        assert.match(html, new RegExp(`E2E ${account.role}`), 'The authenticated panel should show the current user name.')
        assert.match(html, new RegExp(account.email), 'The authenticated panel should show the current user email.')
        assert.match(html, /Cerrar sesión/, 'The account menu should offer a sign-out action.')
        assert.match(html, />E[AR]<\/span>/, 'The account avatar should show initials.')
        if (account.role === 'admin') {
          assert.match(html, /Usuarios y equipo/, 'Admin navigation should expose user management.')
          assert.match(html, /Inventario/, 'Admin navigation should expose inventory.')
          const teamPage = await fetch(new URL('/equipo', base), {
            headers: { cookie: cookies },
            redirect: 'manual',
          })
          assert.equal(teamPage.status, 200, 'Admin should access user management.')
        } else {
          assert.doesNotMatch(html, /Usuarios y equipo/, 'Reception should not see user management.')
          assert.doesNotMatch(html, /Inventario/, 'Reception should not see inventory.')
          assert.match(html, /Agenda/, 'Reception should see the agenda.')
          const teamPage = await fetch(new URL('/equipo', base), {
            headers: { cookie: cookies },
            redirect: 'manual',
          })
          assert.equal(teamPage.status, 307, 'Reception must not access the invitation page.')
        }
      }

      if (account.role === 'admin') {
        browser = await chromium.launch({ headless: true })
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
        await context.addCookies(signup.headers.getSetCookie().map((cookie) => {
          const pair = cookie.split(';', 1)[0]!
          const separator = pair.indexOf('=')
          return {
            name: pair.slice(0, separator),
            value: pair.slice(separator + 1),
            url: base.origin,
          }
        }))
        const page = await context.newPage()
        await page.goto(new URL('/', base).toString())
        await page.goto(new URL('/equipo', base).toString())
        await page.getByRole('heading', { name: 'Usuarios y equipo' }).waitFor()
        await page.getByLabel('Correo electrónico').fill(managedInvitationEmail)
        await page.getByLabel('Rol inicial').selectOption('admin')
        await page.getByRole('button', { name: 'Generar invitación' }).click()
        await page.getByRole('button', { name: 'Copiar enlace' }).waitFor()
        assert.equal((await db.query<{ role: string }>(
          'SELECT role FROM salon_invitation WHERE email = $1',
          [managedInvitationEmail],
        )).rows[0]?.role, 'admin', 'The selected invitation role should persist.')
        const managedCard = page.locator('article').filter({ hasText: managedUserEmail })
        await managedCard.getByLabel('Nombre').fill('Managed HTTP user updated')
        await managedCard.getByLabel('Rol').selectOption('professional')
        await managedCard.getByRole('button', { name: 'Guardar' }).click()
        await page.getByText('Se actualizaron los datos de Managed HTTP user updated.').waitFor()
        const changedRole = await db.query<{ role: string; sessions: string }>(`
          SELECT u.role,
            (SELECT count(*)::text FROM session s WHERE s."userId" = u.id) AS sessions
          FROM "user" u WHERE u.id = $1
        `, [managedUserId])
        assert.equal(changedRole.rows[0]?.role, 'professional')
        assert.equal(changedRole.rows[0]?.sessions, '0', 'Changing role should revoke existing sessions.')

        await db.query(`
          INSERT INTO session (id, "userId", token, "expiresAt")
          VALUES ($1, $2, $3, now() + interval '1 day')
        `, [`http-managed-session-block-${runId}`, managedUserId, `http-managed-token-block-${runId}`])
        await managedCard.getByRole('button', { name: 'Bloquear' }).click()
        await page.getByText('Se bloqueó temporalmente la cuenta de Managed HTTP user updated y se cerraron sus sesiones.').waitFor()
        const blockedUser = await db.query<{ isActive: boolean; sessions: string }>(`
          SELECT u."isActive",
            (SELECT count(*)::text FROM session s WHERE s."userId" = u.id) AS sessions
          FROM "user" u WHERE u.id = $1
        `, [managedUserId])
        assert.equal(blockedUser.rows[0]?.isActive, false)
        assert.equal(blockedUser.rows[0]?.sessions, '0', 'Blocking an account should revoke its sessions.')
        const blockedSignIn = await fetch(new URL('/api/auth/sign-in/email', base), {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: base.origin },
          body: JSON.stringify({ email: managedUserEmail, password: 'irrelevant-test-password' }),
        })
        assert.equal(blockedSignIn.status, 401, 'Blocked accounts must not be able to sign in.')
        await managedCard.getByRole('button', { name: 'Reactivar' }).click()
        await page.getByText('Se reactivó la cuenta de Managed HTTP user updated.').waitFor()
        assert.equal((await db.query<{ isActive: boolean }>(
          'SELECT "isActive" FROM "user" WHERE id = $1',
          [managedUserId],
        )).rows[0]?.isActive, true)

        await page.goto(new URL('/', base).toString())
        await page.getByRole('button', { name: 'Servicios', exact: true }).click()
        await page.getByRole('button', { name: 'Nuevo Servicio' }).click()
        const serviceDialog = page.getByRole('dialog', { name: 'Nuevo Servicio' })
        await serviceDialog.getByLabel('Nombre del Servicio:').fill(demoServiceName)
        await serviceDialog.getByLabel('Precio (ARS):').fill('13500')
        await serviceDialog.getByLabel('Duración Neta (minutos):').fill('45')
        await serviceDialog.getByRole('button', { name: 'Guardar Servicio' }).click()
        await serviceDialog.waitFor({ state: 'hidden' })
        const createdService = await db.query<{ id: string; categoryId: string; price: string }>(
          'SELECT id, "categoryId", price::text FROM service WHERE name = $1',
          [demoServiceName],
        )
        assert.ok(createdService.rows[0], 'Admin UI should create a service in PostgreSQL.')
        const serviceCard = page.locator('.service-admin-card').filter({ hasText: demoServiceName })
        await serviceCard.getByRole('button', { name: 'Editar' }).click()
        const editServiceDialog = page.getByRole('dialog', { name: 'Editar Servicio' })
        await editServiceDialog.getByLabel('Precio (ARS):').fill('14500')
        await editServiceDialog.getByRole('button', { name: 'Guardar Servicio' }).click()
        await editServiceDialog.waitFor({ state: 'hidden' })
        assert.equal((await db.query<{ price: string }>(
          'SELECT price::text FROM service WHERE id = $1',
          [createdService.rows[0].id],
        )).rows[0]?.price, '14500.00', 'Admin UI service edit should persist.')

        await page.getByRole('button', { name: 'Profesionales', exact: true }).click()
        await page.getByRole('button', { name: 'Nueva Profesional' }).click()
        const professionalDialog = page.getByRole('dialog', { name: 'Nueva Profesional' })
        await professionalDialog.getByLabel('Nombre y Apellido:').fill(demoProfessionalName)
        await professionalDialog.getByLabel('Teléfono:').fill(`991${runId.replaceAll('-', '').slice(0, 10)}`)
        await professionalDialog.getByLabel('Especialidades:').fill('Auditoría E2E')
        await professionalDialog.getByRole('button', { name: 'Guardar Profesional' }).click()
        await professionalDialog.waitFor({ state: 'hidden' })
        const createdProfessional = await db.query<{ id: string; specialties: string | null }>(
          'SELECT id, specialties FROM professional WHERE name = $1',
          [demoProfessionalName],
        )
        assert.ok(createdProfessional.rows[0], 'Admin UI should create a professional in PostgreSQL.')
        assert.equal(createdProfessional.rows[0]?.specialties, 'Auditoría E2E')
        const professionalCard = page.locator('.pro-admin-card').filter({ hasText: demoProfessionalName })
        await professionalCard.getByRole('button', { name: 'Editar' }).click()
        const editProfessionalDialog = page.getByRole('dialog', { name: 'Editar Profesional' })
        await editProfessionalDialog.getByLabel('Nombre y Apellido:').fill(demoProfessionalUpdatedName)
        await editProfessionalDialog.getByRole('button', { name: 'Guardar Profesional' }).click()
        await editProfessionalDialog.waitFor({ state: 'hidden' })
        assert.equal((await db.query<{ name: string }>(
          'SELECT name FROM professional WHERE id = $1',
          [createdProfessional.rows[0].id],
        )).rows[0]?.name, demoProfessionalUpdatedName, 'Admin UI professional edit should persist.')
        const updatedProfessionalCard = page.locator('.pro-admin-card').filter({ hasText: demoProfessionalUpdatedName })
        await updatedProfessionalCard.getByRole('button', { name: 'Turnos y Horarios' }).click()
        const schedulesDialog = page.getByRole('dialog', { name: 'Turnos y Horarios de Atención' })
        const scheduleForm = schedulesDialog.locator('.sched-quick-add form')
        await scheduleForm.locator('[name="dayOfWeek"]').selectOption('2')
        await scheduleForm.locator('[name="startTime"]').fill('09:00')
        await scheduleForm.locator('[name="endTime"]').fill('17:00')
        await scheduleForm.getByRole('button', { name: 'Guardar', exact: true }).click()
        const scheduleRow = schedulesDialog.getByRole('row').filter({ hasText: 'Martes' })
        await scheduleRow.getByRole('button', { name: 'Atiende' }).waitFor()
        const savedSchedule = await db.query<{ id: string; startTime: string }>(
          'SELECT id, "startTime" FROM professional_schedule WHERE "professionalId" = $1 AND "dayOfWeek" = 2',
          [createdProfessional.rows[0].id],
        )
        assert.equal(savedSchedule.rows[0]?.startTime, '09:00')
        await scheduleRow.getByRole('button', { name: 'Atiende' }).click()
        await scheduleRow.getByRole('button', { name: 'Franco' }).waitFor()
        assert.equal((await db.query<{ isActive: boolean }>(
          'SELECT "isActive" FROM professional_schedule WHERE id = $1',
          [savedSchedule.rows[0]?.id],
        )).rows[0]?.isActive, false)
        await scheduleRow.getByRole('button', { name: 'Franco' }).click()
        await scheduleRow.getByRole('button', { name: 'Atiende' }).waitFor()
        await schedulesDialog.getByRole('button', { name: 'Listo' }).click()

        await page.getByRole('button', { name: 'Inventario', exact: true }).click()
        await page.getByRole('button', { name: 'Nuevo Material' }).click()
        const materialDialog = page.locator('.modal-backdrop .modal-box')
        await materialDialog.getByLabel('Nombre del Material:').fill(demoMaterialName)
        await materialDialog.getByLabel('Categoría:').fill('Prueba E2E')
        await materialDialog.getByLabel('Unidad de Medida:').fill('unidad')
        await materialDialog.getByLabel('Stock Actual:').fill('10')
        await materialDialog.getByLabel('Stock Mínimo (Alerta):').fill('3')
        await materialDialog.getByRole('button', { name: 'Guardar Material' }).click()
        await materialDialog.waitFor({ state: 'hidden' })
        const createdMaterial = await db.query<{ id: string; currentStock: string }>(
          'SELECT id, "currentStock"::text FROM material WHERE name = $1',
          [demoMaterialName],
        )
        assert.ok(createdMaterial.rows[0], 'Admin UI should create a material in PostgreSQL.')
        assert.equal(createdMaterial.rows[0]?.currentStock, '10.00')
        const materialCard = page.locator('.material-card').filter({ hasText: demoMaterialName })
        await materialCard.getByRole('button', { name: 'Editar' }).click()
        const editMaterialDialog = page.locator('.modal-backdrop .modal-box')
        await editMaterialDialog.getByLabel('Stock Actual:').fill('12')
        await editMaterialDialog.getByRole('button', { name: 'Guardar Material' }).click()
        await editMaterialDialog.waitFor({ state: 'hidden' })
        assert.equal((await db.query<{ currentStock: string }>(
          'SELECT "currentStock"::text FROM material WHERE id = $1',
          [createdMaterial.rows[0].id],
        )).rows[0]?.currentStock, '12.00', 'Admin UI material edit should persist.')

        await page.getByRole('button', { name: 'Registrar Movimiento' }).click()
        const movementDialog = page.getByRole('dialog', { name: 'Registrar Movimiento de Material' })
        await movementDialog.getByLabel('Material:').selectOption(createdMaterial.rows[0].id)
        await movementDialog.getByLabel('Tipo:').selectOption('in')
        await movementDialog.getByLabel('Cantidad:').fill('2')
        await movementDialog.getByLabel('Motivo:').fill(`HTTP E2E ${runId}`)
        await movementDialog.getByRole('button', { name: 'Registrar' }).click()
        await movementDialog.waitFor({ state: 'hidden' })
        const stockMovement = await db.query<{ movementCount: string; currentStock: string }>(`
          SELECT
            (SELECT count(*)::text FROM inventory_movement WHERE "materialId" = $1) AS "movementCount",
            "currentStock"::text AS "currentStock"
          FROM material WHERE id = $1
        `, [createdMaterial.rows[0].id])
        assert.equal(stockMovement.rows[0]?.movementCount, '1')
        assert.equal(stockMovement.rows[0]?.currentStock, '14.00')

        await page.getByRole('button', { name: 'Configuración' }).click()
        const desktopViewportWidths = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        assert.ok(
          desktopViewportWidths.scrollWidth <= desktopViewportWidths.clientWidth,
          `Admin configuration overflows at desktop width: ${JSON.stringify(desktopViewportWidths)}`,
        )
        await page.getByLabel('Nombre del Salón').fill(temporarySalonName)
        const settingsDialogPromise = page.waitForEvent('dialog')
        await page.getByRole('button', { name: 'Guardar Parámetros de Configuración' }).click()
        const settingsDialog = await settingsDialogPromise
        assert.equal(settingsDialog.message(), 'Configuración guardada exitosamente')
        await settingsDialog.accept()
        if (originalSettings) {
          const savedSetting: { rows: Array<{ salonName: string }> } = await db.query(
            'SELECT "salonName" FROM salon_setting WHERE id = $1',
            [originalSettings.id],
          )
          assert.equal(savedSetting.rows[0]?.salonName, temporarySalonName)
        } else {
          assert.equal((await db.query(
            'SELECT 1 FROM salon_setting WHERE "salonName" = $1',
            [temporarySalonName],
          )).rowCount, 1)
        }
        await page.locator('.account-menu > summary').click()
        await page.getByRole('button', { name: 'Cerrar sesión' }).click()
        await page.waitForURL('**/sign-in')
        await context.close()
        await browser.close()
        browser = undefined
        console.log('HTTP user, catalog, professional, inventory, and salon settings E2E passed for admin.')
      }

      const storedRole = await db.query<{ role: string }>(
        'SELECT role FROM "user" WHERE email = $1',
        [account.email],
      )
      assert.equal(storedRole.rows[0]?.role, account.role, 'Registration must store the invited role.')

      if (account.role === 'receptionist') {
        browser = await chromium.launch({ headless: true })
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
        await context.addCookies(signup.headers.getSetCookie().map((cookie) => {
          const pair = cookie.split(';', 1)[0]!
          const separator = pair.indexOf('=')
          return {
            name: pair.slice(0, separator),
            value: pair.slice(separator + 1),
            url: base.origin,
          }
        }))
        const page = await context.newPage()
        await page.goto(new URL('/', base).toString())
        await page.getByRole('button', { name: 'Reservas' }).click()
        const appointmentRow = page.getByRole('row').filter({ hasText: actionClient.name })

        await appointmentRow.getByRole('button', { name: 'Mover' }).click()
        const rescheduleDialog = page.getByRole('dialog', { name: 'Reprogramar Turno' })
        await rescheduleDialog.locator('input[type="date"]').fill(actionRescheduleDate)
        await rescheduleDialog.locator('input[type="time"]').fill('13:30')
        await rescheduleDialog.getByRole('button', { name: 'Guardar Cambio' }).click()
        await page.getByRole('dialog', { name: 'Reprogramar Turno' }).waitFor({ state: 'hidden' })

        await appointmentRow.getByRole('button', { name: 'Cobrar' }).click()
        const paymentDialog = page.getByRole('dialog', { name: 'Registrar Pago / Seña' })
        await paymentDialog.getByLabel('Importe a registrar (ARS)').fill('1200')
        await paymentDialog.getByLabel('Tipo de Operación').selectOption('partial')
        await paymentDialog.getByLabel('Medio de Pago').selectOption('cash')
        await paymentDialog.getByLabel('Comprobante o Detalle (opcional)').fill(`HTTP E2E ${runId}`)
        await paymentDialog.getByRole('button', { name: 'Guardar Pago' }).click()
        await paymentDialog.waitFor({ state: 'hidden' })

        await appointmentRow.getByRole('button', { name: 'Finalizar' }).click()
        await appointmentRow.getByText('Finalizado').waitFor()

        const persistedAction = await db.query<{
          status: string
          visits: number
          historyCount: number
          historyActor: string
          paymentCount: number
          paymentAmount: string
          paymentStatus: string
          startDateTime: string
        }>(`
          SELECT a.status, c.visits, a."paymentStatus",
            to_char(a."startDateTime", 'YYYY-MM-DD"T"HH24:MI') AS "startDateTime",
            (SELECT count(*)::int FROM appointment_history h WHERE h."appointmentId" = a.id) AS "historyCount",
            (SELECT h."actorUserId" FROM appointment_history h
              WHERE h."appointmentId" = a.id AND h.action = 'status:completed'
              ORDER BY h."createdAt" DESC LIMIT 1) AS "historyActor",
            (SELECT count(*)::int FROM payment p WHERE p."appointmentId" = a.id) AS "paymentCount",
            (SELECT amount::text FROM payment p WHERE p."appointmentId" = a.id LIMIT 1) AS "paymentAmount"
          FROM appointment a JOIN client c ON c.id = a."clientId"
          WHERE a.id = $1
        `, [actionAppointmentId])
        assert.equal(persistedAction.rows[0]?.status, 'completed')
        assert.equal(persistedAction.rows[0]?.visits, 1)
        assert.equal(persistedAction.rows[0]?.historyCount, 2)
        assert.equal(persistedAction.rows[0]?.paymentCount, 1)
        assert.equal(persistedAction.rows[0]?.paymentAmount, '1200.00')
        assert.equal(persistedAction.rows[0]?.paymentStatus, 'partially_paid')
        assert.equal(
          persistedAction.rows[0]?.startDateTime,
          `${actionRescheduleDate}T13:30`,
          `Rescheduled appointment time mismatch; row=${JSON.stringify(persistedAction.rows[0])}`,
        )
        assert.equal(persistedAction.rows[0]?.historyActor, (await db.query<{ id: string }>(
            'SELECT id FROM "user" WHERE email = $1',
            [account.email],
          )).rows[0]?.id, 'A real receptionist HTTP session should be recorded as the action actor.')

        await page.reload()
        await page.getByRole('button', { name: 'Clientes' }).click()
        const clientRow = page.getByRole('row').filter({ hasText: actionClient.name })
        await clientRow.getByRole('button', { name: /Ver/ }).click()
        await page.getByText('status:completed').waitFor()
        const clientSearch = page.getByPlaceholder('Buscar clienta por nombre o teléfono...')
        await clientSearch.fill(`not-found-${runId}`)
        await page.getByText('No se encontraron clientas.').waitFor()
        await clientSearch.fill('')
        await page.getByRole('button', { name: 'Nuevo Cliente' }).click()
        const clientDialog = page.getByRole('dialog', { name: 'Nuevo Cliente' })
        const requiredFieldsValidity = await clientDialog.locator('input[required]').evaluateAll(
          (inputs) => inputs.map((input) => (input as HTMLInputElement).checkValidity()),
        )
        assert.ok(requiredFieldsValidity.length >= 2 && requiredFieldsValidity.every((valid) => !valid))
        const mobileFormViewport = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        assert.ok(
          mobileFormViewport.scrollWidth <= mobileFormViewport.clientWidth,
          `Client form overflows at mobile width: ${JSON.stringify(mobileFormViewport)}`,
        )
        await clientDialog.getByLabel('Nombre Completo').fill(actionFormClient.name)
        await clientDialog.getByLabel('Teléfono / WhatsApp').fill(actionFormClient.phone)
        await clientDialog.getByRole('button', { name: 'Guardar' }).click()
        await clientDialog.waitFor({ state: 'hidden' })
        await page.getByRole('row').filter({ hasText: actionFormClient.name }).waitFor()
        assert.equal((await db.query(
          'SELECT 1 FROM client WHERE phone = $1 AND name = $2',
          [actionFormClient.phone, actionFormClient.name],
        )).rowCount, 1, 'The mobile client form should persist through the real HTTP session.')

        const viewportWidths = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowingElements: [...document.querySelectorAll('body *')]
            .map((element) => {
              const rect = element.getBoundingClientRect()
              return {
                tag: element.tagName,
                className: typeof element.className === 'string' ? element.className : '',
                text: element.textContent?.trim().slice(0, 60),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              }
            })
            .filter(({ right, left, width }) => right > 390 || left < 0 || width > 390)
            .slice(0, 10),
        }))
        assert.ok(
          viewportWidths.scrollWidth <= viewportWidths.clientWidth,
          `Authenticated panel overflows at mobile width: ${JSON.stringify(viewportWidths)}`,
        )
        await context.close()
        await browser.close()
        browser = undefined
        console.log('HTTP action, mobile panel, empty-state, and client form E2E passed for receptionist.')
      }

      console.log(`Role E2E passed: ${account.role}.`)
    }
  } finally {
    await browser?.close()
    await cleanup()
    await db.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Role E2E test failed.')
  process.exitCode = 1
})
