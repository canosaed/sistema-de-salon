import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { Client } from 'pg'

loadEnvConfig(process.cwd())

const roles = ['admin', 'receptionist', 'professional'] as const

async function main() {
  const action = process.argv[2]
  const runId = process.argv[3] ?? randomUUID()
  const connectionString = process.env.DATABASE_URL
  if (process.env.SALON_RUN_DB_TESTS !== '1') {
    throw new Error('Set SALON_RUN_DB_TESTS=1 to manage temporary role E2E fixtures.')
  }
  if (!connectionString) throw new Error('DATABASE_URL is required.')
  if (!/^[\da-f-]{36}$/i.test(runId)) throw new Error('A valid fixture run ID is required.')

  const connectionUrl = new URL(connectionString)
  if (!['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname)) {
    throw new Error('Role E2E fixtures are restricted to a local PostgreSQL server.')
  }

  const client = new Client({ connectionString })
  await client.connect()
  try {
    if (action === 'setup') {
      const invitations = roles.map((role) => {
        const token = randomBytes(32).toString('hex')
        return {
          role,
          email: `role-${role}-${runId}@example.invalid`,
          token,
          id: `${runId}-${role}`,
          tokenHash: createHash('sha256').update(token).digest('hex'),
        }
      })
      await client.query('BEGIN')
      try {
        for (const invitation of invitations) {
          await client.query(`
            INSERT INTO salon_invitation (id, email, "tokenHash", role, "expiresAt")
            VALUES ($1, $2, $3, $4, now() + interval '30 minutes')
          `, [invitation.id, invitation.email, invitation.tokenHash, invitation.role])
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
      console.log(JSON.stringify({
        runId,
        accounts: invitations.map(({ role, email, token }) => ({ role, email, token })),
      }))
      return
    }

    if (action !== 'cleanup') throw new Error('Use setup or cleanup <runId>.')
    await client.query('BEGIN')
    try {
      for (const role of roles) {
        const email = `role-${role}-${runId}@example.invalid`
        const accountIds = await client.query<{ userId: string }>(
          'SELECT id AS "userId" FROM "user" WHERE email = $1',
          [email],
        )
        const userIds = accountIds.rows.map(({ userId }) => userId)
        if (userIds.length) {
          await client.query('DELETE FROM session WHERE "userId" = ANY($1::text[])', [userIds])
          await client.query('DELETE FROM account WHERE "userId" = ANY($1::text[])', [userIds])
          await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [userIds])
        }
        await client.query('DELETE FROM salon_invitation WHERE id = $1', [`${runId}-${role}`])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    console.log(`Removed temporary role fixtures ${runId}.`)
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Role fixture operation failed.')
  process.exitCode = 1
})
