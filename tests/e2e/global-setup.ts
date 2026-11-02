import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

let server: ChildProcess | undefined

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()

    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()

      if (address && typeof address === 'object') {
        const { port } = address
        probe.close(() => resolve(port))
        return
      }

      probe.close(() => reject(new Error('Could not allocate a port for e2e server')))
    })
  })
}

async function waitForServer(
  baseUrl: string,
  child: ChildProcess,
  getLogs: () => string
): Promise<void> {
  const deadline = Date.now() + 60_000

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Nuxt server exited with code ${child.exitCode}\n${getLogs()}`)
    }

    try {
      const response = await fetch(baseUrl)

      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting.
    }

    await delay(500)
  }

  throw new Error(`Nuxt server did not start in time\n${getLogs()}`)
}

export default async function setup(): Promise<() => Promise<void>> {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  execFileSync(npmCommand, ['run', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  })

  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`

  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let logs = ''
  server.stdout?.on('data', (chunk: Buffer) => {
    logs += chunk.toString()
  })
  server.stderr?.on('data', (chunk: Buffer) => {
    logs += chunk.toString()
  })

  try {
    await waitForServer(baseUrl, server, () => logs)
  } catch (error) {
    server.kill('SIGTERM')
    throw error
  }

  process.env.E2E_BASE_URL = baseUrl

  return async () => {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM')
      await once(server, 'exit').catch(() => undefined)
    }
  }
}
