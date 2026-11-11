import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { mock, test } from 'node:test'
import { Client } from 'pg'

loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL
const runDatabaseTests = process.env.SALON_RUN_DB_TESTS === '1'
const allowedPanelRoles = ['admin', 'receptionist'] as const
const allowedAdminRoles = ['admin'] as const
let currentRole = 'admin'
let sessionUserId = ''
type RuntimeMockModuleOptions = Parameters<typeof mock.module>[1] & { exports: object }

const staffAuthMockOptions: RuntimeMockModuleOptions = {
  exports: {
    adminRoles: allowedAdminRoles,
    panelRoles: allowedPanelRoles,
    requireSalonRole: async (roles: readonly string[] = allowedPanelRoles) => {
      if (!roles.includes(currentRole)) throw new Error('Forbidden')
      return { id: sessionUserId, role: currentRole }
    },
  },
}
mock.module('@/lib/staff-auth', staffAuthMockOptions)

const cacheMockOptions: RuntimeMockModuleOptions = {
  exports: { revalidatePath: () => undefined },
}
mock.module('next/cache', cacheMockOptions)

const actionModules = Promise.all([
  import('@/app/actions/booking'),
  import('@/app/actions/dashboard'),
  import('@/app/actions/categories'),
  import('@/app/actions/clients'),
  import('@/app/actions/services'),
  import('@/app/actions/professionals'),
  import('@/app/actions/inventory'),
  import('@/app/actions/settings'),
  import('@/app/actions/specialties'),
  import('@/app/actions/team'),
])

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

function scheduleForm(professionalId: string, dayOfWeek: number, id?: string) {
  const form = new FormData()
  if (id) form.set('id', id)
  form.set('professionalId', professionalId)
  form.set('dayOfWeek', String(dayOfWeek))
  form.set('startTime', '09:00')
  form.set('endTime', '17:00')
  form.set('breakStartTime', '')
  form.set('breakEndTime', '')
  form.set('isActive', 'true')
  return form
}

test('public booking and every exported Server Action persist through PostgreSQL', {
  timeout: 60_000,
}, async (t) => {
  const [
    booking,
    dashboard,
    categories,
    clients,
    services,
    professionals,
    inventory,
    settings,
    specialties,
    team,
  ] = await actionModules
  const actionExports = {
    booking: [booking, ['checkPublicAvailability', 'createPublicBooking', 'getPublicBookingCatalog']],
    dashboard: [dashboard, [
      'createInternalAppointment',
      'deleteAppointmentAction',
      'getDashboardData',
      'recordMaterialConsumptionAction',
      'registerAppointmentPaymentAction',
      'rescheduleAppointmentAction',
      'updateAppointmentStatusAction',
    ]],
    categories: [categories, [
      'createCategoryAction',
      'deleteCategoryAction',
      'getCategoriesAction',
      'updateCategoryAction',
    ]],
    clients: [clients, ['createClient', 'deleteClient', 'getClients', 'updateClient']],
    services: [services, ['createService', 'deleteService', 'getServices', 'updateService']],
    professionals: [professionals, [
      'createProfessional',
      'deleteProfessional',
      'deleteScheduleAction',
      'getProfessionals',
      'saveScheduleAction',
      'toggleScheduleAction',
      'updateProfessional',
    ]],
    inventory: [inventory, [
      'createMaterialAction',
      'deleteMaterialAction',
      'getInventoryMaterialsAction',
      'registerStockMovementAction',
      'updateMaterialAction',
    ]],
    settings: [settings, ['getSalonSettingsAction', 'updateSalonSettingsAction']],
    specialties: [specialties, [
      'createSpecialtyAction',
      'deleteSpecialtyAction',
      'getSpecialtiesAction',
      'updateSpecialtyAction',
    ]],
    team: [team, ['createTeamInvitation', 'getTeamUsers', 'setTeamUserActive', 'updateTeamUser']],
  } as const
  let actionCount = 0
  for (const [moduleName, [module, expectedExports]] of Object.entries(actionExports)) {
    assert.deepEqual(
      Object.keys(module).sort(),
      expectedExports,
      `${moduleName} Server Action exports changed; update this integration suite.`,
    )
    actionCount += expectedExports.length
  }
  assert.equal(actionCount, 44, 'The suite must account for every exported Server Action.')
  assert.ok(runDatabaseTests, 'Set SALON_RUN_DB_TESTS=1 to run action integration tests.')
  assert.ok(connectionString, 'DATABASE_URL is required.')
  const databaseUrl = new URL(connectionString)
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname),
    'Action integration tests are restricted to a local PostgreSQL server.',
  )

  const db = new Client({ connectionString })
  const runId = randomUUID()
  const phonePrefix = `997${runId.replaceAll('-', '').slice(0, 9)}`
  const emails = [
    `action-${runId}@example.invalid`,
    `invite-${runId}@example.invalid`,
    `invite-admin-${runId}@example.invalid`,
    `invite-professional-${runId}@example.invalid`,
    `managed-${runId}@example.invalid`,
  ]
  const managedUserId = `team-user-${runId}`
  const appointmentIds: string[] = []
  const professionalServiceIds: string[] = []
  const professionalIds: string[] = []
  const serviceIds: string[] = []
  const categoryIds: string[] = []
  const specialtyIds: string[] = []
  const materialIds: string[] = []
  const scheduleIds: string[] = []
  const clientPhones = [`${phonePrefix}1`, `${phonePrefix}2`, `${phonePrefix}4`]
  await db.connect()
  const originalSettings = await (async () => {
    const userRow = await db.query<{ id: string }>(
      'SELECT id FROM "user" LIMIT 1',
    )
    assert.ok(userRow.rows[0], 'Action integration tests require an existing salon account.')
    sessionUserId = userRow.rows[0].id
    process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3000'
    return db.query('SELECT * FROM salon_setting LIMIT 1')
  })()

  async function cleanup() {
    await db.query('BEGIN')
    try {
      await db.query('DELETE FROM payment WHERE "appointmentId" = ANY($1::text[])', [appointmentIds])
      await db.query('DELETE FROM inventory_movement WHERE "appointmentId" = ANY($1::text[]) OR "materialId" = ANY($2::text[])', [appointmentIds, materialIds])
      await db.query('DELETE FROM appointment_history WHERE "appointmentId" = ANY($1::text[])', [appointmentIds])
      await db.query('DELETE FROM appointment_service WHERE "appointmentId" = ANY($1::text[])', [appointmentIds])
      await db.query('DELETE FROM appointment WHERE id = ANY($1::text[])', [appointmentIds])
      await db.query('DELETE FROM client WHERE phone = ANY($1::text[])', [clientPhones])
      await db.query('DELETE FROM salon_invitation WHERE email = ANY($1::text[])', [emails])
      await db.query('DELETE FROM session WHERE "userId" = $1', [managedUserId])
      await db.query('DELETE FROM account WHERE "userId" = $1', [managedUserId])
      await db.query('DELETE FROM "user" WHERE id = $1', [managedUserId])
      await db.query('DELETE FROM professional_schedule WHERE id = ANY($1::text[])', [scheduleIds])
      await db.query('DELETE FROM professional_service WHERE id = ANY($1::text[])', [professionalServiceIds])
      await db.query('DELETE FROM material WHERE id = ANY($1::text[])', [materialIds])
      await db.query('DELETE FROM service WHERE id = ANY($1::text[])', [serviceIds])
      await db.query('DELETE FROM professional_specialty WHERE "professionalId" = ANY($1::text[])', [professionalIds])
      await db.query('DELETE FROM professional WHERE id = ANY($1::text[])', [professionalIds])
      await db.query('DELETE FROM specialty WHERE id = ANY($1::text[])', [specialtyIds])
      await db.query('DELETE FROM service_category WHERE id = ANY($1::text[])', [categoryIds])
      if (originalSettings.rows[0]) {
        await db.query(
          'UPDATE salon_setting SET "salonName" = $2, "updatedAt" = $3 WHERE id = $1',
          [
            originalSettings.rows[0].id,
            originalSettings.rows[0].salonName,
            originalSettings.rows[0].updatedAt,
          ],
        )
      } else {
        await db.query('DELETE FROM salon_setting WHERE "salonName" = $1', [`Temporary E2E ${runId}`])
      }
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  }

  try {
    await db.query(`
      INSERT INTO "user" (id, name, email, role, "isActive")
      VALUES ($1, 'Managed account', $2, 'receptionist', true)
    `, [managedUserId, emails[4]])
    await db.query(`
      INSERT INTO session (id, "userId", token, "expiresAt")
      VALUES ($1, $2, $3, now() + interval '1 day')
    `, [`team-session-${runId}`, managedUserId, `team-token-${runId}`])

    const listedUsers = await team.getTeamUsers()
    const listedManagedUser = listedUsers.find(({ id }) => id === managedUserId)
    assert.equal(listedManagedUser?.email, emails[4])
    assert.equal('password' in (listedManagedUser ?? {}), false)

    const updatedManagedUser = await team.updateTeamUser({
      id: managedUserId,
      name: 'Updated managed account',
      role: 'professional',
    })
    assert.equal(updatedManagedUser?.role, 'professional')
    assert.equal(updatedManagedUser?.name, 'Updated managed account')
    assert.equal((await db.query('SELECT id FROM session WHERE "userId" = $1', [managedUserId])).rowCount, 0)

    const promotedManagedUser = await team.updateTeamUser({
      id: managedUserId,
      name: 'Updated managed account',
      role: 'admin',
    })
    assert.equal(promotedManagedUser?.role, 'admin')
    const blockedManagedUser = await team.setTeamUserActive({ id: managedUserId, isActive: false })
    assert.equal(blockedManagedUser?.isActive, false)
    const reactivatedManagedUser = await team.setTeamUserActive({ id: managedUserId, isActive: true })
    assert.equal(reactivatedManagedUser?.isActive, true)
    const demotedManagedUser = await team.updateTeamUser({
      id: managedUserId,
      name: 'Updated managed account',
      role: 'receptionist',
    })
    assert.equal(demotedManagedUser?.role, 'receptionist')
    await assert.rejects(
      team.setTeamUserActive({ id: sessionUserId, isActive: false }),
      /No podés bloquear tu propia cuenta/,
    )
    await assert.rejects(
      team.updateTeamUser({ id: sessionUserId, name: 'Admin', role: 'receptionist' }),
      /No podés quitarte el rol de administrador/,
    )

    const category = await categories.createCategoryAction({
      name: `Action E2E ${runId}`,
      description: 'temporary integration fixture',
    })
    categoryIds.push(category.id)
    assert.equal((await categories.getCategoriesAction()).some(({ id }) => id === category.id), true)
    const updatedCategory = await categories.updateCategoryAction(category.id, {
      name: `Action E2E updated ${runId}`,
      order: 901,
    })
    assert.match(updatedCategory.slug, /action-e2e-updated/)
    const firstSpecialty = await specialties.createSpecialtyAction(`E2E specialty one ${runId}`)
    specialtyIds.push(firstSpecialty.id)
    const secondSpecialty = await specialties.createSpecialtyAction(`E2E specialty two ${runId}`)
    specialtyIds.push(secondSpecialty.id)
    const renamedSpecialty = await specialties.updateSpecialtyAction(firstSpecialty.id, `E2E specialty renamed ${runId}`)
    assert.match(renamedSpecialty.name, /renamed/)
    assert.equal((await specialties.getSpecialtiesAction()).some(({ id }) => id === secondSpecialty.id), true)

    const service = await services.createService({
      categoryId: category.id,
      name: `Public E2E ${runId}`,
      price: 1800,
      durationMinutes: 30,
      depositType: 'fixed',
      depositValue: 200,
    })
    serviceIds.push(service.id)
    await assert.rejects(
      categories.deleteCategoryAction(category.id),
      /tiene servicios asociados/,
      'A category assigned to a service must not be deleted.',
    )
    const unusedCategory = await categories.createCategoryAction({
      name: `Unused action E2E ${runId}`,
      description: 'temporary unused category',
    })
    categoryIds.push(unusedCategory.id)
    assert.equal((await categories.deleteCategoryAction(unusedCategory.id)).id, unusedCategory.id)
    categoryIds.splice(categoryIds.indexOf(unusedCategory.id), 1)
    assert.ok((await services.getServices()).some(({ id }) => id === service.id))
    const updatedService = await services.updateService(service.id, { price: 1900 })
    assert.equal(Number(updatedService?.price), 1900)

    const professional = await professionals.createProfessional({
      name: `Action professional ${runId}`,
      phone: `${phonePrefix}3`,
    })
    professionalIds.push(professional.id)
    assert.ok((await professionals.getProfessionals()).some(({ id }) => id === professional.id))
    const updatedProfessional = await professionals.updateProfessional(professional.id, {
      specialtyIds: [firstSpecialty.id, secondSpecialty.id],
    })
    assert.deepEqual(new Set(updatedProfessional?.specialtyIds), new Set([firstSpecialty.id, secondSpecialty.id]))
    assert.match(updatedProfessional?.specialties || '', /E2E specialty renamed/)
    await assert.rejects(
      specialties.deleteSpecialtyAction(firstSpecialty.id),
      /está asignada/,
      'A specialty assigned to a professional must not be deleted.',
    )
    const professionalServiceId = randomUUID()
    professionalServiceIds.push(professionalServiceId)
    await db.query(
      'INSERT INTO professional_service (id, "professionalId", "serviceId") VALUES ($1, $2, $3)',
      [professionalServiceId, professional.id, service.id],
    )

    const firstDate = salonDate(2)
    const secondDate = salonDate(9)
    const firstDay = new Date(`${firstDate}T00:00:00Z`).getUTCDay()
    const secondDay = new Date(`${secondDate}T00:00:00Z`).getUTCDay()
    const schedule = await professionals.saveScheduleAction(scheduleForm(professional.id, firstDay))
    scheduleIds.push(schedule.id)
    assert.equal((await professionals.toggleScheduleAction(schedule.id)).isActive, false)
    assert.equal((await professionals.toggleScheduleAction(schedule.id)).isActive, true)
    const savedSchedule = await professionals.saveScheduleAction(scheduleForm(professional.id, secondDay))
    scheduleIds.push(savedSchedule.id)
    const updatedSchedule = await professionals.saveScheduleAction(
      scheduleForm(professional.id, secondDay, savedSchedule.id),
    )
    assert.equal(updatedSchedule.endTime, '17:00')

    const catalog = await booking.getPublicBookingCatalog()
    assert.ok(catalog.services.some(({ id }) => id === service.id))
    assert.deepEqual(
      new Set(catalog.professionals.find(({ id }) => id === professional.id)?.specialties),
      new Set([renamedSpecialty.name, secondSpecialty.name]),
    )
    const availability = await booking.checkPublicAvailability({
      serviceId: service.id,
      professionalId: professional.id,
      dateStr: firstDate,
    })
    assert.ok(availability.slots.some(({ time }) => time === '09:00'))
    assert.equal(availability.totalPrice, 1900)
    const publicBooking = await booking.createPublicBooking({
      serviceId: service.id,
      professionalId: professional.id,
      date: firstDate,
      time: '09:00',
      clientName: `Public client ${runId}`,
      clientPhone: clientPhones[0]!,
      clientEmail: emails[0],
      notes: 'public booking action integration',
    })
    appointmentIds.push(publicBooking.appointment.id)
    assert.equal(publicBooking.success, true)
    assert.equal(publicBooking.appointment.requiredDeposit, 200)
    const persistedPublic = await db.query<{
      status: string
      services: string
      history: string
    }>(`
      SELECT a.status,
        (SELECT count(*)::text FROM appointment_service s WHERE s."appointmentId" = a.id) AS services,
        (SELECT count(*)::text FROM appointment_history h WHERE h."appointmentId" = a.id) AS history
      FROM appointment a WHERE a.id = $1
    `, [publicBooking.appointment.id])
    assert.equal(persistedPublic.rows[0]?.status, 'pending_confirmation')
    assert.equal(persistedPublic.rows[0]?.services, '1')
    assert.equal(persistedPublic.rows[0]?.history, '1')

    const createdClient = await clients.createClient({
      name: `Action client ${runId}`,
      phone: clientPhones[1]!,
    })
    assert.ok((await clients.getClients()).some(({ id }) => id === createdClient.id))
    assert.equal((await clients.updateClient({
      id: createdClient.id,
      name: `Updated client ${runId}`,
      phone: clientPhones[1]!,
    })).name, `Updated client ${runId}`)

    const internalAppointment = await dashboard.createInternalAppointment({
      clientName: `Internal client ${runId}`,
      clientPhone: `${phonePrefix}4`,
      serviceIds: [service.id],
      professionalId: professional.id,
      date: firstDate,
      time: '11:00',
    })
    appointmentIds.push(internalAppointment.id)
    assert.equal(internalAppointment.status, 'confirmed')
    const updatedStatus = await dashboard.updateAppointmentStatusAction(
      internalAppointment.id,
      'in_progress',
    )
    assert.equal(updatedStatus.status, 'in_progress')
    const completedAppointment = await dashboard.updateAppointmentStatusAction(
      internalAppointment.id,
      'completed',
    )
    assert.equal(completedAppointment.status, 'completed')
    const visitCount = async () => {
      const result = await db.query<{ visits: number }>(
        'SELECT visits FROM client WHERE phone = $1',
        [`${phonePrefix}4`],
      )
      return result.rows[0]?.visits
    }
    assert.equal(await visitCount(), 1)
    await dashboard.updateAppointmentStatusAction(internalAppointment.id, 'completed')
    assert.equal(await visitCount(), 1, 'Repeating completion must not count an extra visit.')
    const appointmentWithHistory = (await dashboard.getDashboardData()).appointments
      .find(({ id }) => id === internalAppointment.id)
    assert.ok(appointmentWithHistory?.history.some(({ action }) => action === 'status:completed'))
    await dashboard.updateAppointmentStatusAction(internalAppointment.id, 'confirmed')
    assert.equal(await visitCount(), 0, 'Reverting completion must remove the completed visit.')

    const rescheduled = await dashboard.rescheduleAppointmentAction(
      internalAppointment.id,
      secondDate,
      '11:00',
    )
    assert.equal(rescheduled.date, secondDate)
    const payment = await dashboard.registerAppointmentPaymentAction({
      appointmentId: internalAppointment.id,
      amount: 250,
      method: 'cash',
      type: 'partial',
      notes: 'E2E payment',
    })
    assert.equal(Number(payment.payment.amount), 250)
    assert.ok((await dashboard.getDashboardData()).appointments.some(({ id }) => id === internalAppointment.id))

    const material = await inventory.createMaterialAction({
      name: `Action material ${runId}`,
      category: 'E2E',
      unit: 'unit',
      currentStock: 10,
      minimumStock: 2,
    })
    assert.equal(material.success, true)
    if (!material.success) throw new Error(material.error)
    assert.ok(material.material)
    const materialRecord = material.material
    materialIds.push(materialRecord.id)
    assert.equal((await inventory.getInventoryMaterialsAction()).success, true)
    assert.equal((await inventory.updateMaterialAction(materialRecord.id, {
      name: `Updated material ${runId}`,
    })).success, true)
    const movement = await dashboard.recordMaterialConsumptionAction({
      materialId: materialRecord.id,
      type: 'out',
      quantity: 1,
      reason: 'E2E appointment consumption',
      appointmentId: internalAppointment.id,
    })
    assert.equal(movement.material.currentStock, '9.00')
    assert.ok(movement.movement.id)
    const stockAdjustment = await inventory.registerStockMovementAction({
      materialId: materialRecord.id,
      type: 'adjustment',
      quantity: 10,
      reason: 'E2E direct stock adjustment',
    })
    assert.equal(stockAdjustment.success, true)

    const settingsBefore = await settings.getSalonSettingsAction()
    assert.equal(settingsBefore.success, true)
    const settingsAfter = await settings.updateSalonSettingsAction({
      salonName: `Temporary E2E ${runId}`,
    })
    assert.equal(settingsAfter.success, true)
    if (settingsAfter.success) assert.equal(settingsAfter.settings?.salonName, `Temporary E2E ${runId}`)

    const invitation = await team.createTeamInvitation({ email: emails[1]!, role: 'receptionist' })
    assert.ok(invitation.invitationUrl.includes('/sign-up#invitation_token='))
    assert.equal(invitation.role, 'receptionist')
    const adminInvitation = await team.createTeamInvitation({ email: emails[2]!, role: 'admin' })
    const professionalInvitation = await team.createTeamInvitation({
      email: emails[3]!,
      role: 'professional',
    })
    assert.equal(adminInvitation.role, 'admin')
    assert.equal(professionalInvitation.role, 'professional')

    currentRole = 'receptionist'
    assert.ok((await clients.getClients()).length >= 1)
    assert.equal((await dashboard.getDashboardData()).role, 'receptionist')
    await assert.rejects(
      services.createService({
        categoryId: category.id,
        name: 'Forbidden reception service',
        price: 100,
        durationMinutes: 30,
      }),
      /Forbidden/,
    )
    currentRole = 'professional'
    await assert.rejects(dashboard.getDashboardData(), /Forbidden/)
    await assert.rejects(clients.getClients(), /Forbidden/)
    currentRole = 'admin'

    const publicStatus = await dashboard.updateAppointmentStatusAction(
      publicBooking.appointment.id,
      'confirmed',
    )
    assert.equal(publicStatus.status, 'confirmed')
    await dashboard.updateAppointmentStatusAction(internalAppointment.id, 'completed')
    assert.equal(await visitCount(), 1)
    await dashboard.deleteAppointmentAction(internalAppointment.id)
    assert.equal(await visitCount(), 0, 'Deleting a completed appointment must remove its visit.')
    await clients.deleteClient(createdClient.id)
    assert.equal(await professionals.deleteScheduleAction(savedSchedule.id).then(Boolean), true)
    scheduleIds.splice(scheduleIds.indexOf(savedSchedule.id), 1)
    await professionals.updateProfessional(professional.id, { specialtyIds: [] })
    assert.ok((await inventory.deleteMaterialAction(materialRecord.id)).success)
    assert.ok((await professionals.deleteProfessional(professional.id)).id)
    professionalIds.splice(professionalIds.indexOf(professional.id), 1)
    await specialties.deleteSpecialtyAction(firstSpecialty.id)
    specialtyIds.splice(specialtyIds.indexOf(firstSpecialty.id), 1)
    await specialties.deleteSpecialtyAction(secondSpecialty.id)
    specialtyIds.splice(specialtyIds.indexOf(secondSpecialty.id), 1)
    await services.deleteService(service.id)

    assert.equal((await services.getServices()).some(({ id }) => id === service.id), false)
    t.diagnostic(`Covered all ${actionCount} exported actions across booking, dashboard, categories, clients, services, professionals, inventory, settings, and team.`)
  } catch (error) {
    t.diagnostic(error instanceof Error ? error.stack || error.message : String(error))
    throw error
  } finally {
    currentRole = 'admin'
    await cleanup()
    await db.end()
  }
})
