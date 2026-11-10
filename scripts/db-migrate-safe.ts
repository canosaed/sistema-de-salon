import { loadEnvConfig } from '@next/env'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

interface SnapshotColumn {
  type: string
  notNull: boolean
  primaryKey: boolean
}

interface SnapshotTable {
  columns: Record<string, SnapshotColumn>
  uniqueConstraints: Record<string, { name: string }>
}

interface MigrationEntry {
  idx: number
  when: number
  tag: string
}

function expectedPostgresType(type: string) {
  if (type.startsWith('numeric')) return 'numeric'
  if (type === 'timestamp') return 'timestamp without time zone'
  return type
}

async function main() {
  loadEnvConfig(process.cwd())
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured.')

  const snapshot = JSON.parse(readFileSync(
    resolve(process.cwd(), 'drizzle/meta/0001_snapshot.json'),
    'utf8',
  )) as { tables: Record<string, SnapshotTable> }
  const migrationJournal = JSON.parse(readFileSync(
    resolve(process.cwd(), 'drizzle/meta/_journal.json'),
    'utf8',
  )) as { entries: MigrationEntry[] }
  const baselineEntries = migrationJournal.entries.filter(({ idx }) => idx < 2)
  if (baselineEntries.length !== 2) {
    throw new Error('Expected exactly two existing baseline migrations before the new migrations.')
  }

  const pool = new Pool({ connectionString })
  try {
    const identity = await pool.query<{ database: string }>('SELECT current_database() AS database')
    const accidentalJournal = await pool.query<{ exists: boolean }>(
      `SELECT to_regclass('public.__drizzle_migrations') IS NOT NULL AS exists`,
    )
    if (accidentalJournal.rows[0]?.exists) {
      const rows = await pool.query<{ hash: string; createdAt: string }>(
        'SELECT hash, created_at AS "createdAt" FROM public.__drizzle_migrations ORDER BY created_at',
      )
      const expectedRows = await Promise.all(baselineEntries.map(async (entry) => ({
        hash: createHash('sha256')
          .update(readFileSync(resolve(process.cwd(), 'drizzle', `${entry.tag}.sql`), 'utf8'))
          .digest('hex'),
        createdAt: String(entry.when),
      })))
      if (rows.rows.length !== expectedRows.length ||
          rows.rows.some((row, index) =>
            row.hash !== expectedRows[index]?.hash || String(row.createdAt) !== expectedRows[index]?.createdAt
          )) {
        throw new Error('Unexpected public migration table found; refusing to alter it.')
      }
      await pool.query('DROP TABLE public."__drizzle_migrations"')
      console.log('Removed the temporary public migration table created by the failed initial attempt.')
    }

    const journalTable = await pool.query<{ exists: boolean }>(
      `SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`,
    )
    const journalRecords = journalTable.rows[0]?.exists
      ? await pool.query<{ createdAt: string }>(
          'SELECT created_at AS "createdAt" FROM drizzle.__drizzle_migrations ORDER BY created_at',
        )
      : { rows: [] }
    if (journalRecords.rows.length > 0) {
      const lastRecorded = journalRecords.rows.at(-1)
      const lastBaseline = baselineEntries.at(-1)
      if (!lastRecorded || !lastBaseline ||
          journalRecords.rows.length < baselineEntries.length ||
          Number(lastRecorded.createdAt) < lastBaseline.when) {
        throw new Error('Existing Drizzle history is incomplete; refusing to run migrations.')
      }
    }

    if (journalRecords.rows.length === 0) {
      const expectedTables = Object.keys(snapshot.tables)
        .map((qualifiedName) => qualifiedName.split('.').at(-1))
        .filter((name): name is string => Boolean(name))
      const actualTables = await pool.query<{ tableName: string }>(`
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `)
      const actualTableNames = new Set(actualTables.rows.map(({ tableName }) => tableName))
      const missingTables = expectedTables.filter((name) => !actualTableNames.has(name))
      if (missingTables.length > 0) {
        throw new Error(`Cannot reconcile migration history; missing baseline tables: ${missingTables.join(', ')}`)
      }

      const actualColumns = await pool.query<{
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
      const columnMap = new Map(actualColumns.rows.map((column) => [
        `${column.tableName}.${column.columnName}`,
        column,
      ]))
      const mismatches: string[] = []
      for (const [qualifiedName, table] of Object.entries(snapshot.tables)) {
        const tableName = qualifiedName.split('.').at(-1)
        if (!tableName) continue
        for (const [columnName, expected] of Object.entries(table.columns)) {
          const actual = columnMap.get(`${tableName}.${columnName}`)
          if (!actual) {
            mismatches.push(`missing ${tableName}.${columnName}`)
            continue
          }
          const type = expectedPostgresType(expected.type)
          if (actual.dataType !== type) {
            mismatches.push(`${tableName}.${columnName} type should be ${type}, found ${actual.dataType}`)
          }
          if ((actual.isNullable === 'NO') !== expected.notNull) {
            mismatches.push(`${tableName}.${columnName} has unexpected nullability`)
          }
        }
      }
      const expectedColumnNames = new Set(Object.entries(snapshot.tables).flatMap(([qualifiedName, table]) => {
        const tableName = qualifiedName.split('.').at(-1)
        return tableName ? Object.keys(table.columns).map((columnName) => `${tableName}.${columnName}`) : []
      }))
      const unexpectedColumns = actualColumns.rows
        .map(({ tableName, columnName }) => `${tableName}.${columnName}`)
        .filter((name) => !expectedColumnNames.has(name))
      if (unexpectedColumns.length > 0) {
        mismatches.push(`unexpected columns: ${unexpectedColumns.join(', ')}`)
      }

      const actualConstraints = await pool.query<{ constraintName: string }>(`
        SELECT conname AS "constraintName"
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND contype IN ('p', 'u')
      `)
      const actualConstraintNames = new Set(actualConstraints.rows.map(({ constraintName }) => constraintName))
      for (const [qualifiedName, table] of Object.entries(snapshot.tables)) {
        const tableName = qualifiedName.split('.').at(-1)
        if (!tableName) continue
        if (Object.values(table.columns).some(({ primaryKey }) => primaryKey) &&
            !actualConstraintNames.has(`${tableName}_pkey`)) {
          mismatches.push(`missing primary key ${tableName}_pkey`)
        }
        for (const { name } of Object.values(table.uniqueConstraints)) {
          if (!actualConstraintNames.has(name)) mismatches.push(`missing unique constraint ${name}`)
        }
      }
      if (mismatches.length > 0) {
        throw new Error(`Cannot reconcile migration history: ${mismatches.join('; ')}`)
      }

      const overlaps = await pool.query<{ count: string }>(`
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
      if (overlaps.rows[0]?.count !== '0') {
        throw new Error('Cannot apply the overlap guard while active overlapping appointments exist.')
      }

      await pool.query('BEGIN')
      try {
        await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
        await pool.query(`
          CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
            id serial PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `)
        for (const entry of baselineEntries) {
          const sql = readFileSync(resolve(process.cwd(), 'drizzle', `${entry.tag}.sql`), 'utf8')
          const hash = createHash('sha256').update(sql).digest('hex')
          await pool.query(
            'INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
            [hash, entry.when],
          )
        }
        await pool.query('COMMIT')
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }
      console.log(`Recorded verified baseline migrations for ${identity.rows[0]?.database}.`)
    } else {
      console.log(`Using existing Drizzle migration history for ${identity.rows[0]?.database}.`)
    }

    await migrate(drizzle(pool), { migrationsFolder: resolve(process.cwd(), 'drizzle') })

    const overlapIndex = await pool.query<{ exists: boolean }>(
      `SELECT to_regclass('public.appointment_active_interval_idx') IS NOT NULL AS exists`,
    )
    if (!overlapIndex.rows[0]?.exists) {
      await pool.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS appointment_active_interval_idx
          ON public.appointment ("professionalId", "startDateTime", "endDateTime")
          WHERE status IN ('pending_confirmation', 'confirmed', 'waiting', 'in_progress')
      `)
      console.log('Recreated the missing active-appointment interval index.')
    }

    const result = await pool.query<{
      invitationTable: boolean
      overlapTrigger: boolean
      overlapIndex: boolean
      userActiveColumn: boolean
    }>(`
      SELECT
        to_regclass('public.salon_invitation') IS NOT NULL AS "invitationTable",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'user'
            AND column_name = 'isActive' AND data_type = 'boolean' AND is_nullable = 'NO'
        ) AS "userActiveColumn",
        EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'appointment_prevent_overlap' AND NOT tgisinternal
        ) AS "overlapTrigger",
        to_regclass('public.appointment_active_interval_idx') IS NOT NULL AS "overlapIndex"
    `)
    if (!result.rows[0]?.invitationTable ||
        !result.rows[0]?.userActiveColumn ||
        !result.rows[0]?.overlapTrigger ||
        !result.rows[0]?.overlapIndex) {
      throw new Error('Migration completed without all expected database objects.')
    }
    console.log(JSON.stringify({
      database: identity.rows[0]?.database,
      applied: result.rows[0],
    }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Safe database migration failed.')
  process.exitCode = 1
})
