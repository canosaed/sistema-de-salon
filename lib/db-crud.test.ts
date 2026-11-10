import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'
import test from 'node:test'
import { adminRoles, isSalonRoleAllowed, panelRoles } from '@/lib/role-policy'

loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL
const runDatabaseTests = process.env.SALON_RUN_DB_TESTS === '1'

test('PostgreSQL CRUD and persistence survive a new connection', { timeout: 30_000 }, async () => {
  assert.ok(runDatabaseTests, 'Set SALON_RUN_DB_TESTS=1 to run database tests.')
  assert.ok(connectionString, 'DATABASE_URL is required for database tests.')

  const connectionUrl = new URL(connectionString)
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname),
    'Database tests are restricted to a local PostgreSQL server.',
  )

  const ids = {
    entity: randomUUID(),
    category: randomUUID(),
    service: randomUUID(),
    technique: randomUUID(),
    professional: randomUUID(),
    schedule: randomUUID(),
    absence: randomUUID(),
    block: randomUUID(),
    client: randomUUID(),
    appointment: randomUUID(),
    appointmentService: randomUUID(),
    history: randomUUID(),
    payment: randomUUID(),
    material: randomUUID(),
    movement: randomUUID(),
    invitation: randomUUID(),
    adminUser: randomUUID(),
    receptionUser: randomUUID(),
    professionalUser: randomUUID(),
  }
  const clientPhone = `998${ids.entity.replaceAll('-', '').slice(0, 10)}`
  const first = new Client({ connectionString })
  const verifier = new Client({ connectionString })
  let committed = false

  async function cleanup(db: Client) {
    await db.query('BEGIN')
    try {
      await db.query('DELETE FROM salon_invitation WHERE id = $1', [ids.invitation])
      await db.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
        [ids.adminUser, ids.receptionUser, ids.professionalUser],
      ])
      await db.query('DELETE FROM inventory_movement WHERE id = $1', [ids.movement])
      await db.query('DELETE FROM material WHERE id = $1', [ids.material])
      await db.query('DELETE FROM payment WHERE id = $1', [ids.payment])
      await db.query('DELETE FROM appointment_history WHERE id = $1', [ids.history])
      await db.query('DELETE FROM appointment_service WHERE id = $1', [ids.appointmentService])
      await db.query('DELETE FROM appointment WHERE id = $1', [ids.appointment])
      await db.query('DELETE FROM client WHERE id = $1', [ids.client])
      await db.query('DELETE FROM schedule_block WHERE id = $1', [ids.block])
      await db.query('DELETE FROM professional_absence WHERE id = $1', [ids.absence])
      await db.query('DELETE FROM professional_schedule WHERE id = $1', [ids.schedule])
      await db.query('DELETE FROM professional_service WHERE id = $1', [ids.entity])
      await db.query('DELETE FROM technique WHERE id = $1', [ids.technique])
      await db.query('DELETE FROM service WHERE id = $1', [ids.service])
      await db.query('DELETE FROM professional WHERE id = $1', [ids.professional])
      await db.query('DELETE FROM service_category WHERE id = $1', [ids.category])
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  }

  try {
    await Promise.all([first.connect(), verifier.connect()])
    await first.query('BEGIN')
    await first.query(`
      INSERT INTO service_category (id, name, slug, "order") VALUES ($1, 'CRUD test', $2, 1)
    `, [ids.category, `crud-${ids.entity}`])
    await first.query(`
      UPDATE service_category SET name = 'CRUD test updated', "order" = 2 WHERE id = $1
    `, [ids.category])
    assert.equal((await first.query('SELECT name FROM service_category WHERE id = $1', [ids.category])).rows[0]?.name, 'CRUD test updated')

    await first.query(`
      INSERT INTO professional (id, name, phone, "isActive") VALUES ($1, 'CRUD professional', $2, true)
    `, [ids.professional, clientPhone])
    await first.query(`
      UPDATE professional SET name = 'CRUD professional updated' WHERE id = $1
    `, [ids.professional])
    assert.equal((await first.query('SELECT name FROM professional WHERE id = $1', [ids.professional])).rows[0]?.name, 'CRUD professional updated')

    await first.query(`
      INSERT INTO service (
        id, "categoryId", name, price, "durationMinutes", "depositType", "depositValue"
      ) VALUES ($1, $2, 'CRUD service', 1200, 30, 'fixed', 100)
    `, [ids.service, ids.category])
    await first.query('UPDATE service SET price = 1500 WHERE id = $1', [ids.service])
    assert.equal((await first.query('SELECT price FROM service WHERE id = $1', [ids.service])).rows[0]?.price, '1500.00')

    await first.query(`
      INSERT INTO technique (id, "serviceId", name, "additionalPrice") VALUES ($1, $2, 'CRUD technique', 25)
    `, [ids.technique, ids.service])
    await first.query('UPDATE technique SET name = $2 WHERE id = $1', [ids.technique, 'CRUD technique updated'])
    assert.equal((await first.query('SELECT name FROM technique WHERE id = $1', [ids.technique])).rows[0]?.name, 'CRUD technique updated')

    await first.query(`
      INSERT INTO professional_service (id, "professionalId", "serviceId") VALUES ($1, $2, $3)
    `, [ids.entity, ids.professional, ids.service])
    await first.query(`
      UPDATE professional_service SET "serviceId" = $2 WHERE id = $1
    `, [ids.entity, ids.service])
    assert.equal((await first.query('SELECT count(*)::int AS count FROM professional_service WHERE id = $1', [ids.entity])).rows[0]?.count, 1)

    await first.query(`
      INSERT INTO professional_schedule (id, "professionalId", "dayOfWeek", "startTime", "endTime")
      VALUES ($1, $2, 2, '09:00', '17:00')
    `, [ids.schedule, ids.professional])
    await first.query("UPDATE professional_schedule SET \"endTime\" = '18:00' WHERE id = $1", [ids.schedule])
    assert.equal((await first.query('SELECT "endTime" FROM professional_schedule WHERE id = $1', [ids.schedule])).rows[0]?.endTime, '18:00')

    await first.query(`
      INSERT INTO professional_absence (id, "professionalId", "startDate", "endDate", reason)
      VALUES ($1, $2, '2035-01-01', '2035-01-02', 'CRUD test')
    `, [ids.absence, ids.professional])
    await first.query("UPDATE professional_absence SET reason = 'CRUD updated' WHERE id = $1", [ids.absence])
    assert.equal((await first.query('SELECT reason FROM professional_absence WHERE id = $1', [ids.absence])).rows[0]?.reason, 'CRUD updated')

    await first.query(`
      INSERT INTO schedule_block (id, "professionalId", "startDateTime", "endDateTime", reason)
      VALUES ($1, $2, '2035-01-01 10:00', '2035-01-01 10:30', 'CRUD test')
    `, [ids.block, ids.professional])
    await first.query("UPDATE schedule_block SET reason = 'CRUD updated' WHERE id = $1", [ids.block])
    assert.equal((await first.query('SELECT reason FROM schedule_block WHERE id = $1', [ids.block])).rows[0]?.reason, 'CRUD updated')

    const owner = await first.query<{ id: string }>('SELECT id FROM "user" ORDER BY "createdAt" LIMIT 1')
    assert.ok(owner.rows[0], 'CRUD test requires an existing salon account.')
    await first.query(`
      INSERT INTO "user" (id, name, email, role) VALUES
        ($1, 'CRUD admin', $4, 'admin'),
        ($2, 'CRUD reception', $5, 'receptionist'),
        ($3, 'CRUD professional', $6, 'professional')
    `, [
      ids.adminUser,
      ids.receptionUser,
      ids.professionalUser,
      `admin-${ids.entity}@example.invalid`,
      `reception-${ids.entity}@example.invalid`,
      `professional-${ids.entity}@example.invalid`,
    ])
    const storedRoles = await first.query<{ role: string }>(
      'SELECT role FROM "user" WHERE id = ANY($1::text[]) ORDER BY role',
      [[ids.adminUser, ids.receptionUser, ids.professionalUser]],
    )
    assert.deepEqual(storedRoles.rows.map(({ role }) => role), ['admin', 'professional', 'receptionist'])
    const roleByName = new Set(storedRoles.rows.map(({ role }) => role))
    for (const role of roleByName) {
      assert.equal(isSalonRoleAllowed(role, panelRoles), role !== 'professional')
      assert.equal(isSalonRoleAllowed(role, adminRoles), role === 'admin')
    }
    await first.query(`
      INSERT INTO client (id, "userId", name, phone, visits, "isActive") VALUES ($1, $2, 'CRUD client', $3, 0, true)
    `, [ids.client, owner.rows[0].id, clientPhone])
    await first.query("UPDATE client SET name = 'CRUD client updated', visits = 1 WHERE id = $1", [ids.client])
    assert.equal((await first.query('SELECT name FROM client WHERE id = $1', [ids.client])).rows[0]?.name, 'CRUD client updated')

    await first.query(`
      INSERT INTO appointment (
        id, "clientId", "professionalId", "startDateTime", "endDateTime",
        "totalDurationMinutes", "totalPrice", "requiredDeposit", status, "paymentStatus"
      ) VALUES ($1, $2, $3, '2035-01-03 10:00', '2035-01-03 10:30', 30, 1500, 100, 'confirmed', 'pending')
    `, [ids.appointment, ids.client, ids.professional])
    await first.query("UPDATE appointment SET notes = 'CRUD updated' WHERE id = $1", [ids.appointment])
    assert.equal((await first.query('SELECT notes FROM appointment WHERE id = $1', [ids.appointment])).rows[0]?.notes, 'CRUD updated')
    await first.query(`
      INSERT INTO appointment_service (
        id, "appointmentId", "serviceId", "techniqueId", "historicServiceName",
        "historicPrice", "historicDurationMinutes"
      ) VALUES ($1, $2, $3, $4, 'CRUD service', 1525, 30)
    `, [ids.appointmentService, ids.appointment, ids.service, ids.technique])
    await first.query(`
      INSERT INTO appointment_history (id, "appointmentId", action, details) VALUES ($1, $2, 'created', 'CRUD test')
    `, [ids.history, ids.appointment])
    await first.query(`
      UPDATE appointment_history SET details = 'CRUD updated' WHERE id = $1
    `, [ids.history])
    await first.query(`
      INSERT INTO payment (id, "appointmentId", amount, method, type, status)
      VALUES ($1, $2, 100, 'cash', 'deposit', 'completed')
    `, [ids.payment, ids.appointment])
    await first.query("UPDATE payment SET amount = 125 WHERE id = $1", [ids.payment])
    assert.equal((await first.query('SELECT amount FROM payment WHERE id = $1', [ids.payment])).rows[0]?.amount, '125.00')

    await first.query(`
      INSERT INTO material (id, name, category, unit, "currentStock", "minStock")
      VALUES ($1, 'CRUD material', 'test', 'unit', 5, 1)
    `, [ids.material])
    await first.query('UPDATE material SET "currentStock" = 4 WHERE id = $1', [ids.material])
    await first.query(`
      INSERT INTO inventory_movement (id, "materialId", type, quantity, reason)
      VALUES ($1, $2, 'out', 1, 'CRUD test')
    `, [ids.movement, ids.material])
    await first.query("UPDATE inventory_movement SET reason = 'CRUD updated' WHERE id = $1", [ids.movement])
    assert.equal((await first.query('SELECT reason FROM inventory_movement WHERE id = $1', [ids.movement])).rows[0]?.reason, 'CRUD updated')

    await first.query(`
      INSERT INTO salon_invitation (id, email, "tokenHash", role, "expiresAt")
      VALUES ($1, $2, $3, 'receptionist', now() + interval '1 hour')
    `, [ids.invitation, `crud-${ids.entity}@example.invalid`, ids.entity])
    await first.query(`
      UPDATE salon_invitation SET "acceptedAt" = now() WHERE id = $1
    `, [ids.invitation])
    assert.ok((await first.query('SELECT "acceptedAt" FROM salon_invitation WHERE id = $1', [ids.invitation])).rows[0]?.acceptedAt)

    await first.query("UPDATE professional SET \"isActive\" = false WHERE id = $1", [ids.professional])
    await first.query("UPDATE service SET \"isActive\" = false WHERE id = $1", [ids.service])
    await first.query("UPDATE material SET \"isActive\" = false WHERE id = $1", [ids.material])
    await first.query("UPDATE client SET \"isActive\" = false WHERE id = $1", [ids.client])
    assert.equal((await first.query('SELECT count(*)::int AS count FROM service WHERE id = $1 AND "isActive" = false', [ids.service])).rows[0]?.count, 1)
    await first.query('COMMIT')
    committed = true

    const persisted = await verifier.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM appointment_history WHERE id = $1',
      [ids.history],
    )
    assert.equal(persisted.rows[0]?.count, '1', 'Committed data must be visible from a fresh connection.')
    await cleanup(verifier)
    committed = false
    assert.equal((await verifier.query('SELECT count(*)::int AS count FROM appointment WHERE id = $1', [ids.appointment])).rows[0]?.count, 0)
  } finally {
    if (committed) await cleanup(verifier)
    await Promise.all([first.end(), verifier.end()])
  }
})
