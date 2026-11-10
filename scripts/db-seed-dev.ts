import { loadEnvConfig } from '@next/env'
import { Pool } from 'pg'
import { getSalonDateString } from '../lib/salon-time'

type SeedValue = string | number | boolean | null
type SeedRow = Record<string, SeedValue>

const id = {
  categories: ['dev-demo-category-hands', 'dev-demo-category-feet', 'dev-demo-category-lashes'],
  services: ['dev-demo-service-semipermanent', 'dev-demo-service-gel', 'dev-demo-service-pedicure', 'dev-demo-service-lashes'],
  techniques: ['dev-demo-technique-nail-art', 'dev-demo-technique-strengthening', 'dev-demo-technique-lash-volume'],
  professionals: ['dev-demo-professional-ana', 'dev-demo-professional-lucia'],
  clients: ['dev-demo-client-sofia', 'dev-demo-client-valentina', 'dev-demo-client-martina', 'dev-demo-client-julieta'],
  materials: ['dev-demo-material-polish', 'dev-demo-material-files', 'dev-demo-material-lash-glue'],
  appointments: ['dev-demo-appointment-completed', 'dev-demo-appointment-confirmed', 'dev-demo-appointment-pending'],
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year!, month! - 1, day! + days))
  return next.toISOString().slice(0, 10)
}

function nextWeekday(date: string) {
  let candidate = date
  do {
    candidate = addDays(candidate, 1)
  } while ([0, 6].includes(new Date(`${candidate}T00:00:00Z`).getUTCDay()))
  return candidate
}

async function upsertRows(client: import('pg').PoolClient, table: string, rows: SeedRow[]) {
  if (rows.length === 0) return
  const columns = Object.keys(rows[0]!)
  const values = rows.flatMap((row) => columns.map((column) => row[column] ?? null))
  const placeholders = rows.map((_, rowIndex) => {
    const rowValues = columns.map((__, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`)
    return `(${rowValues.join(', ')})`
  })
  const assignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(', ')

  await client.query(
    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')})
     VALUES ${placeholders.join(', ')}
     ON CONFLICT ("id") DO UPDATE SET ${assignments}`,
    values,
  )
}

async function main() {
  loadEnvConfig(process.cwd())
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is disabled when NODE_ENV=production.')
  }
  if (process.env.SALON_ALLOW_DEV_SEED !== '1') {
    throw new Error('Set SALON_ALLOW_DEV_SEED=1 to explicitly allow local development seed data.')
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured.')
  const databaseUrl = new URL(connectionString)
  const hostname = databaseUrl.hostname.replace(/^\[|\]$/g, '')
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Development seed is restricted to localhost PostgreSQL.')
  }
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1))
  if (/(^|[-_])(prod|production)([-_]|$)/i.test(databaseName)) {
    throw new Error(`Refusing to seed a production-named database: ${databaseName}`)
  }

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8_000 })
  const client = await pool.connect()
  try {
    const identity = await client.query<{
      database: string
      readOnly: string
    }>(`
      SELECT current_database() AS database,
        current_setting('transaction_read_only') AS "readOnly"
    `)
    if (identity.rows[0]?.readOnly === 'on') {
      throw new Error('The connected database is read-only; refusing to seed.')
    }

    await client.query('BEGIN')
    const today = getSalonDateString()
    const firstWeekday = nextWeekday(today)
    const secondWeekday = nextWeekday(firstWeekday)
    const lastWeekday = addDays(firstWeekday, -7)

    await upsertRows(client, 'service_category', [
      { id: id.categories[0]!, name: 'Manos (demo)', slug: 'dev-demo-manos', description: 'Categoría de ejemplo para desarrollo.', order: 1 },
      { id: id.categories[1]!, name: 'Pies (demo)', slug: 'dev-demo-pies', description: 'Categoría de ejemplo para desarrollo.', order: 2 },
      { id: id.categories[2]!, name: 'Pestañas (demo)', slug: 'dev-demo-pestanas', description: 'Categoría de ejemplo para desarrollo.', order: 3 },
    ])

    await upsertRows(client, 'service', [
      { id: id.services[0]!, categoryId: id.categories[0]!, name: 'Esmaltado semipermanente (demo)', description: 'Servicio ficticio para probar el flujo de turnos.', price: '18000', durationMinutes: 60, prepMinutes: 10, cleanupMinutes: 10, depositType: 'fixed', depositValue: '5000', allowPublicBooking: true, isActive: true, cancellationPolicy: 'Cancelación de demostración.' },
      { id: id.services[1]!, categoryId: id.categories[0]!, name: 'Kapping en gel (demo)', description: 'Servicio ficticio para probar técnicas y duración.', price: '26000', durationMinutes: 75, prepMinutes: 10, cleanupMinutes: 10, depositType: 'percentage', depositValue: '30', allowPublicBooking: true, isActive: true, cancellationPolicy: 'Cancelación de demostración.' },
      { id: id.services[2]!, categoryId: id.categories[1]!, name: 'Pedicuría básica (demo)', description: 'Servicio ficticio para probar categorías.', price: '22000', durationMinutes: 60, prepMinutes: 10, cleanupMinutes: 10, depositType: 'fixed', depositValue: '5000', allowPublicBooking: true, isActive: true, cancellationPolicy: 'Cancelación de demostración.' },
      { id: id.services[3]!, categoryId: id.categories[2]!, name: 'Lifting de pestañas (demo)', description: 'Servicio ficticio de pestañas para desarrollo.', price: '24000', durationMinutes: 60, prepMinutes: 10, cleanupMinutes: 10, depositType: 'percentage', depositValue: '30', allowPublicBooking: true, isActive: true, cancellationPolicy: 'Cancelación de demostración.' },
    ])

    await upsertRows(client, 'technique', [
      { id: id.techniques[0]!, serviceId: id.services[0]!, name: 'Nail art simple (demo)', description: 'Técnica de ejemplo.', additionalPrice: '3000', additionalMinutes: 15, isActive: true },
      { id: id.techniques[1]!, serviceId: id.services[1]!, name: 'Refuerzo (demo)', description: 'Técnica de ejemplo.', additionalPrice: '4000', additionalMinutes: 15, isActive: true },
      { id: id.techniques[2]!, serviceId: id.services[3]!, name: 'Volumen suave (demo)', description: 'Técnica de ejemplo.', additionalPrice: '5000', additionalMinutes: 20, isActive: true },
    ])

    await upsertRows(client, 'professional', [
      { id: id.professionals[0]!, name: 'Ana Demo', phone: '+5491100000101', email: 'ana.demo@example.invalid', specialties: 'Manicuría, kapping', initials: 'AD', isActive: true },
      { id: id.professionals[1]!, name: 'Lucía Demo', phone: '+5491100000102', email: 'lucia.demo@example.invalid', specialties: 'Pedicuría, pestañas', initials: 'LD', isActive: true },
    ])

    await upsertRows(client, 'professional_service', [
      { id: 'dev-demo-link-ana-semipermanent', professionalId: id.professionals[0]!, serviceId: id.services[0]! },
      { id: 'dev-demo-link-ana-gel', professionalId: id.professionals[0]!, serviceId: id.services[1]! },
      { id: 'dev-demo-link-lucia-pedicure', professionalId: id.professionals[1]!, serviceId: id.services[2]! },
      { id: 'dev-demo-link-lucia-lashes', professionalId: id.professionals[1]!, serviceId: id.services[3]! },
    ])

    await upsertRows(client, 'professional_schedule', id.professionals.flatMap((professionalId) =>
      [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        id: `dev-demo-schedule-${professionalId.endsWith('ana') ? 'ana' : 'lucia'}-${dayOfWeek}`,
        professionalId,
        dayOfWeek,
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '13:00',
        breakEndTime: '14:00',
        isActive: true,
      })),
    ))

    await upsertRows(client, 'client', [
      { id: id.clients[0]!, name: 'Sofía Demo', phone: '+5491100000201', email: 'sofia.demo@example.invalid', birthDate: '1995-04-12', notes: 'Ficha ficticia de desarrollo.', preferences: 'Prefiere tonos neutros.', visits: 1, isActive: true },
      { id: id.clients[1]!, name: 'Valentina Demo', phone: '+5491100000202', email: 'valentina.demo@example.invalid', birthDate: '1992-08-23', notes: 'Ficha ficticia de desarrollo.', preferences: 'Sin preferencias registradas.', visits: 0, isActive: true },
      { id: id.clients[2]!, name: 'Martina Demo', phone: '+5491100000203', email: 'martina.demo@example.invalid', birthDate: '2000-01-05', notes: 'Ficha ficticia de desarrollo.', preferences: 'Prefiere turnos por la mañana.', visits: 0, isActive: true },
      { id: id.clients[3]!, name: 'Julieta Demo', phone: '+5491100000204', email: 'julieta.demo@example.invalid', birthDate: '1989-11-17', notes: 'Ficha ficticia de desarrollo.', preferences: 'Sin preferencias registradas.', visits: 0, isActive: true },
    ])

    await upsertRows(client, 'material', [
      { id: id.materials[0]!, name: 'Esmalte rojo (demo)', category: 'Esmaltes', unit: 'unidad', currentStock: '8', minStock: '3', isActive: true },
      { id: id.materials[1]!, name: 'Lima descartable (demo)', category: 'Herramientas', unit: 'unidad', currentStock: '2', minStock: '5', isActive: true },
      { id: id.materials[2]!, name: 'Adhesivo de pestañas (demo)', category: 'Pestañas', unit: 'ml', currentStock: '12', minStock: '4', isActive: true },
    ])

    await upsertRows(client, 'service_material', [
      { id: 'dev-demo-service-material-polish', serviceId: id.services[0]!, techniqueId: null, materialId: id.materials[0]!, estimatedUsage: '0.10' },
      { id: 'dev-demo-service-material-file', serviceId: id.services[1]!, techniqueId: id.techniques[1]!, materialId: id.materials[1]!, estimatedUsage: '1' },
      { id: 'dev-demo-service-material-lashes', serviceId: id.services[3]!, techniqueId: id.techniques[2]!, materialId: id.materials[2]!, estimatedUsage: '0.50' },
    ])

    await upsertRows(client, 'inventory_movement', [
      { id: 'dev-demo-inventory-movement-polish', materialId: id.materials[0]!, type: 'in', quantity: '8', reason: 'Stock inicial ficticio de desarrollo.' },
      { id: 'dev-demo-inventory-movement-file', materialId: id.materials[1]!, type: 'in', quantity: '2', reason: 'Stock inicial ficticio de desarrollo.' },
      { id: 'dev-demo-inventory-movement-lashes', materialId: id.materials[2]!, type: 'in', quantity: '12', reason: 'Stock inicial ficticio de desarrollo.' },
    ])

    await upsertRows(client, 'appointment', [
      { id: id.appointments[0]!, clientId: id.clients[0]!, professionalId: id.professionals[0]!, startDateTime: `${lastWeekday} 10:00:00`, endDateTime: `${lastWeekday} 11:35:00`, totalDurationMinutes: 95, totalPrice: '21000', requiredDeposit: '5000', status: 'completed', paymentStatus: 'paid', notes: 'Turno completado de ejemplo.', clientPreferences: 'Prefiere tonos neutros.', isPublicBooking: false },
      { id: id.appointments[1]!, clientId: id.clients[1]!, professionalId: id.professionals[0]!, startDateTime: `${firstWeekday} 10:00:00`, endDateTime: `${firstWeekday} 11:35:00`, totalDurationMinutes: 95, totalPrice: '21000', requiredDeposit: '5000', status: 'confirmed', paymentStatus: 'deposit_paid', notes: 'Turno confirmado de ejemplo.', clientPreferences: null, isPublicBooking: false },
      { id: id.appointments[2]!, clientId: id.clients[2]!, professionalId: id.professionals[1]!, startDateTime: `${secondWeekday} 15:00:00`, endDateTime: `${secondWeekday} 16:40:00`, totalDurationMinutes: 100, totalPrice: '29000', requiredDeposit: '5000', status: 'pending_confirmation', paymentStatus: 'pending', notes: 'Turno pendiente de ejemplo.', clientPreferences: 'Prefiere turnos por la mañana.', isPublicBooking: true },
    ])

    await upsertRows(client, 'appointment_service', [
      { id: 'dev-demo-appointment-service-completed', appointmentId: id.appointments[0]!, serviceId: id.services[0]!, techniqueId: id.techniques[0]!, historicServiceName: 'Esmaltado semipermanente (demo)', historicTechniqueName: 'Nail art simple (demo)', historicPrice: '21000', historicDurationMinutes: 75, historicPrepMinutes: 10, historicCleanupMinutes: 10, sequenceOrder: 1 },
      { id: 'dev-demo-appointment-service-confirmed', appointmentId: id.appointments[1]!, serviceId: id.services[0]!, techniqueId: id.techniques[0]!, historicServiceName: 'Esmaltado semipermanente (demo)', historicTechniqueName: 'Nail art simple (demo)', historicPrice: '21000', historicDurationMinutes: 75, historicPrepMinutes: 10, historicCleanupMinutes: 10, sequenceOrder: 1 },
      { id: 'dev-demo-appointment-service-pending', appointmentId: id.appointments[2]!, serviceId: id.services[3]!, techniqueId: id.techniques[2]!, historicServiceName: 'Lifting de pestañas (demo)', historicTechniqueName: 'Volumen suave (demo)', historicPrice: '29000', historicDurationMinutes: 80, historicPrepMinutes: 10, historicCleanupMinutes: 10, sequenceOrder: 1 },
    ])

    await upsertRows(client, 'appointment_history', [
      { id: 'dev-demo-history-completed', appointmentId: id.appointments[0]!, action: 'created', details: 'Turno demo completado.', snapshot: JSON.stringify({ source: 'dev-seed' }) },
      { id: 'dev-demo-history-confirmed', appointmentId: id.appointments[1]!, action: 'created', details: 'Turno demo confirmado.', snapshot: JSON.stringify({ source: 'dev-seed' }) },
      { id: 'dev-demo-history-pending', appointmentId: id.appointments[2]!, action: 'created', details: 'Turno demo pendiente.', snapshot: JSON.stringify({ source: 'dev-seed' }) },
    ])

    await upsertRows(client, 'payment', [
      { id: 'dev-demo-payment-completed', appointmentId: id.appointments[0]!, amount: '21000', method: 'transfer', type: 'full', status: 'completed', notes: 'Pago ficticio de desarrollo.', referenceNumber: 'DEV-DEMO-001' },
      { id: 'dev-demo-payment-deposit', appointmentId: id.appointments[1]!, amount: '5000', method: 'cash', type: 'deposit', status: 'completed', notes: 'Seña ficticia de desarrollo.', referenceNumber: 'DEV-DEMO-002' },
    ])

    const settings = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM salon_setting')
    if (settings.rows[0]?.count === '0') {
      await upsertRows(client, 'salon_setting', [{
        id: 'dev-demo-salon-setting',
        salonName: 'Salón de Demostración',
        timeZone: 'America/Argentina/Buenos_Aires',
        currency: 'ARS',
        minNoticeHoursForBooking: 2,
        minNoticeHoursForCancellation: 24,
        autoConfirmPublicBookings: false,
        defaultDepositType: 'percentage',
        defaultDepositPercentage: 30,
        defaultDepositFixed: '5000',
      }])
    }

    await client.query('COMMIT')
    console.log(JSON.stringify({
      database: identity.rows[0]?.database,
      seeded: {
        categories: 3,
        services: 4,
        techniques: 3,
        professionals: 2,
        clients: 4,
        materials: 3,
        appointments: 3,
        settingsCreated: settings.rows[0]?.count === '0',
      },
      appointments: {
        completed: `${lastWeekday} 10:00`,
        confirmed: `${firstWeekday} 10:00`,
        pending: `${secondWeekday} 15:00`,
      },
    }, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Development database seed failed.')
  process.exitCode = 1
})
