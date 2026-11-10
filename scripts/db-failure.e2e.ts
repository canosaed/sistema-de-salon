import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createConnection, createServer } from 'node:net'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  if (process.env.SALON_RUN_DB_TESTS !== '1') {
    throw new Error('Set SALON_RUN_DB_TESTS=1 to run database failure tests.')
  }
  const connectionString = process.env.DATABASE_URL
  assert.ok(connectionString, 'DATABASE_URL is required.')
  const databaseUrl = new URL(connectionString)
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname),
    'Database failure tests are restricted to a local PostgreSQL environment.',
  )

  let forwardConnections = false
  const server = createServer((client) => {
    if (!forwardConnections) {
      client.destroy()
      return
    }

    const database = createConnection({
      host: databaseUrl.hostname,
      port: Number(databaseUrl.port || 5432),
    })
    client.pipe(database)
    database.pipe(client)
    database.on('error', () => client.destroy())
    client.on('error', () => database.destroy())
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  assert.ok(address && typeof address !== 'string', 'Could not bind the local test proxy.')

  const childUrl = new URL(connectionString)
  childUrl.hostname = '127.0.0.1'
  childUrl.port = String(address.port)
  const probe = `
    const { getPublicBookingCatalog } = await import('./app/actions/booking.ts');
    const { pool } = await import('./lib/db/index.ts');
    function errorCode(error) {
      let cause = error;
      while (cause && typeof cause === 'object' && 'cause' in cause && cause.cause) cause = cause.cause;
      return cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
    }
    try {
      await getPublicBookingCatalog();
      console.error('UNEXPECTED_DATABASE_SUCCESS');
      process.exitCode = 2;
      await pool.end();
    } catch (error) {
      const code = errorCode(error);
      if (!['ECONNRESET', 'ECONNREFUSED', '08006', '08001'].includes(code)) {
        console.error('UNEXPECTED_DATABASE_ERROR:' + String(code ?? 'unknown'));
        process.exitCode = 3;
        await pool.end();
      } else {
        console.log('DATABASE_FAILURE_SURFACED');
        process.stdin.once('data', async () => {
          try {
            const catalog = await getPublicBookingCatalog();
            if (!Array.isArray(catalog.categories)) throw new Error('Catalog response was invalid.');
            console.log('DATABASE_RECOVERED');
          } catch (recoveryError) {
            console.error('DATABASE_RECOVERY_FAILED:' + String(errorCode(recoveryError) ?? 'unknown'));
            process.exitCode = 4;
          } finally {
            await pool.end();
          }
        });
      }
    }
  `
  const child = spawn(process.execPath, [
    '--import',
    'tsx',
    '--input-type=module',
    '-e',
    probe,
  ], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: childUrl.toString() },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for isolated database failure.')), 15_000)
      child.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once('close', (code) => {
        clearTimeout(timeout)
        reject(new Error(`Probe exited before the outage assertion (${code}): ${stderr}`))
      })
      child.stdout.on('data', () => {
        if (stdout.includes('DATABASE_FAILURE_SURFACED')) {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    forwardConnections = true
    child.stdin.end('resume\n')
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(
        `Timed out waiting for database reconnection. Output: ${stdout} ${stderr}`,
      )), 15_000)
      child.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      child.once('close', (code) => {
        clearTimeout(timeout)
        resolve(code)
      })
    })
    assert.equal(exitCode, 0, `Database recovery probe failed: ${stderr}`)
    assert.match(stdout, /DATABASE_FAILURE_SURFACED/)
    assert.match(stdout, /DATABASE_RECOVERED/)
  } finally {
    if (child.exitCode === null) child.kill()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  console.log('Database failure was surfaced and the same isolated app pool recovered after connectivity returned.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Database failure E2E failed.')
  process.exitCode = 1
})
