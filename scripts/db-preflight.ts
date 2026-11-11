import { loadEnvConfig } from '@next/env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from 'pg'

async function main() {
  loadEnvConfig(process.cwd())
  const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), 'drizzle/meta/0001_snapshot.json'), 'utf8')) as {
    tables: Record<string, { columns: Record<string, { type: string; notNull: boolean }> }>
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const connectionUrl = new URL(connectionString)
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8_000,
    ssl: connectionUrl.searchParams.get('sslmode') === 'require'
      ? { rejectUnauthorized: false }
      : undefined,
  })

  try {
    await client.connect()

    const identity = await client.query<{
      database: string
      username: string
      serverAddress: string | null
      transactionReadOnly: string
    }>(`
      SELECT
        current_database() AS database,
        current_user AS username,
        inet_server_addr()::text AS "serverAddress",
        current_setting('transaction_read_only') AS "transactionReadOnly"
    `)
    const tables = await client.query<{ tableName: string }>(`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const databaseColumns = await client.query<{
      tableName: string
      columnName: string
      dataType: string
      isNullable: 'YES' | 'NO'
    }>(`
      SELECT table_name AS "tableName", column_name AS "columnName",
        data_type AS "dataType", is_nullable AS "isNullable"
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `)
    const columnMap = new Map(databaseColumns.rows.map((column) => [
      `${column.tableName}.${column.columnName}`,
      column,
    ]))
    const schemaDifferences: string[] = []
    const expectedColumns = new Set<string>()
    for (const [qualifiedName, table] of Object.entries(snapshot.tables)) {
      const tableName = qualifiedName.split('.').at(-1)
      if (!tableName) continue
      for (const [columnName, expected] of Object.entries(table.columns)) {
        expectedColumns.add(`${tableName}.${columnName}`)
        const actual = columnMap.get(`${tableName}.${columnName}`)
        if (!actual) {
          schemaDifferences.push(`missing ${tableName}.${columnName}`)
          continue
        }
        const expectedType = expected.type.startsWith('numeric')
          ? 'numeric'
          : expected.type === 'timestamp'
            ? 'timestamp without time zone'
            : expected.type
        if (actual.dataType !== expectedType) {
          schemaDifferences.push(`type ${tableName}.${columnName}: expected ${expectedType}, got ${actual.dataType}`)
        }
        if ((actual.isNullable === 'NO') !== expected.notNull) {
          schemaDifferences.push(`nullability ${tableName}.${columnName}: expected ${expected.notNull ? 'NOT NULL' : 'NULL'}`)
        }
      }
    }
    const migratedColumns = new Set([
      'user.isActive',
      'specialty.id',
      'specialty.name',
      'specialty.createdAt',
      'professional_specialty.id',
      'professional_specialty.professionalId',
      'professional_specialty.specialtyId',
    ])
    const extraColumns = databaseColumns.rows
      .map(({ tableName, columnName }) => `${tableName}.${columnName}`)
      .filter((name) =>
        !expectedColumns.has(name) &&
        !name.startsWith('salon_invitation.') &&
        !migratedColumns.has(name)
      )
    const overlapGuard = await client.query<{ triggerExists: boolean; indexExists: boolean }>(`
      SELECT
        EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'appointment_prevent_overlap' AND NOT tgisinternal
        ) AS "triggerExists",
        to_regclass('public.appointment_active_interval_idx') IS NOT NULL AS "indexExists"
    `)
    const appointmentIndexes = await client.query<{
      schemaName: string
      indexName: string
      definition: string
    }>(`
      SELECT schemaname AS "schemaName", indexname AS "indexName", indexdef AS definition
      FROM pg_indexes
      WHERE tablename = 'appointment'
      ORDER BY schemaname, indexname
    `)
    const activeOverlaps = tables.rows.some(({ tableName }) => tableName === 'appointment')
      ? await client.query<{ count: string }>(`
          SELECT count(*)::text AS count
          FROM appointment a
          JOIN appointment b
            ON a."professionalId" = b."professionalId"
           AND a.id < b.id
           AND a."startDateTime" < b."endDateTime"
           AND a."endDateTime" > b."startDateTime"
          WHERE a.status IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')
            AND b.status IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')
        `)
      : null
    const journalStates: Array<{ schemaName: string; rowCount: string }> = []
    for (const schemaName of ['public', 'drizzle']) {
      const exists = await client.query<{ exists: boolean }>(
        'SELECT to_regclass($1) IS NOT NULL AS exists',
        [`${schemaName}.__drizzle_migrations`],
      )
      if (exists.rows[0]?.exists) {
        const count = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM "${schemaName}"."__drizzle_migrations"`,
        )
        journalStates.push({ schemaName, rowCount: count.rows[0]?.count ?? '0' })
      }
    }
    const migrationJournalExists = journalStates.some(({ schemaName }) => schemaName === 'drizzle')
    const publicJournalCount = tables.rows.some(({ tableName }) => tableName === '__drizzle_migrations')
      ? await client.query<{ count: string }>('SELECT count(*)::text AS count FROM public.__drizzle_migrations')
      : null
    const legacyAuditExists = tables.rows.some(({ tableName }) => tableName === 'schema_migration_audit')
    const migrationAudit = legacyAuditExists
      ? await client.query<{ migrationName: string }>(`
          SELECT migration_name AS "migrationName"
          FROM schema_migration_audit
          ORDER BY migration_name
        `)
      : null
    const emailVerifiedType = await client.query<{ dataType: string | null }>(`
      SELECT data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'emailVerified'
    `)
    const userActiveStatus = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user'
          AND column_name = 'isActive' AND data_type = 'boolean' AND is_nullable = 'NO'
      ) AS exists
    `)
    const specialtyCatalog = await client.query<{
      specialtyTable: boolean
      professionalSpecialtyTable: boolean
      specialtyNameIndex: boolean
      professionalSpecialtyPairIndex: boolean
    }>(`
      SELECT
        to_regclass('public.specialty') IS NOT NULL AS "specialtyTable",
        to_regclass('public.professional_specialty') IS NOT NULL AS "professionalSpecialtyTable",
        to_regclass('public.specialty_name_lower_unique') IS NOT NULL AS "specialtyNameIndex",
        to_regclass('public.professional_specialty_pair_unique') IS NOT NULL AS "professionalSpecialtyPairIndex"
    `)
    const appointmentCount = tables.rows.some(({ tableName }) => tableName === 'appointment')
      ? await client.query<{ count: string }>('SELECT count(*)::text AS count FROM appointment')
      : null
    const catalogCounts = await client.query<Record<string, string>>(`
      SELECT
        (SELECT count(*) FROM service WHERE "isActive" = true)::text AS services,
        (SELECT count(*) FROM professional WHERE "isActive" = true)::text AS professionals,
        (SELECT count(*) FROM professional_schedule WHERE "isActive" = true)::text AS schedules,
        (SELECT count(*) FROM professional_service)::text AS "professionalServices"
    `)
    const accountCounts = await client.query<{ users: string; sessions: string; roles: Array<{ role: string; count: string }> }>(`
      SELECT
        (SELECT count(*)::text FROM "user") AS users,
        (SELECT count(*)::text FROM session) AS sessions,
        COALESCE((
          SELECT json_agg(json_build_object('role', role, 'count', count))
          FROM (
            SELECT role, count(*)::text AS count FROM "user" GROUP BY role
          ) role_counts
        ), '[]'::json) AS roles
    `)

    console.log(JSON.stringify({
      host: connectionUrl.hostname,
      database: identity.rows[0]?.database,
      serverAddress: identity.rows[0]?.serverAddress,
      readOnly: identity.rows[0]?.transactionReadOnly,
      publicTables: tables.rows.map(({ tableName }) => tableName),
      baselineSchemaDifferences: schemaDifferences,
      extraColumns,
      migrationJournalExists,
      migrationJournal: journalStates,
      publicMigrationJournalRows: publicJournalCount?.rows[0]?.count ?? 'not present',
      legacyMigrationAudit: migrationAudit?.rows.map(({ migrationName }) => migrationName) ?? [],
      emailVerifiedType: emailVerifiedType.rows[0]?.dataType ?? 'not available',
      userActiveStatusColumn: userActiveStatus.rows[0]?.exists ?? false,
      specialtyCatalog: specialtyCatalog.rows[0] ?? null,
      appointmentCount: appointmentCount?.rows[0]?.count ?? 'not available',
      catalogCounts: catalogCounts.rows[0] ?? {},
      accountCounts: accountCounts.rows[0] ?? {},
      overlapGuard: overlapGuard.rows[0] ?? null,
      appointmentIndexes: appointmentIndexes.rows,
      activeOverlapPairs: activeOverlaps?.rows[0]?.count ?? 'not available',
      note: 'Read-only inspection only; no migration or data changes were performed.',
    }, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'PostgreSQL preflight failed.')
  process.exitCode = 1
})
