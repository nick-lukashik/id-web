// Runs the standalone build the way the container does: static assets (and
// public/, if any) next to server.js, then `node server.js`.
//   pnpm build && pnpm start        # PORT=3000 by default
import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const standalone = path.join(root, '.next/standalone')
if (!existsSync(path.join(standalone, 'server.js'))) {
    console.error('No standalone build. Run `pnpm build` first.')
    process.exit(1)
}
if (existsSync('.env.local')) process.loadEnvFile('.env.local')

cpSync(path.join(root, '.next/static'), path.join(standalone, '.next/static'), {
    recursive: true,
})
if (existsSync(path.join(root, 'public'))) {
    cpSync(path.join(root, 'public'), path.join(standalone, 'public'), {
        recursive: true,
    })
}

const child = spawn(
    process.execPath,
    [
        path.join(standalone, 'server.js'),
    ],
    {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: process.env.PORT ?? '3000',
            HOSTNAME: process.env.HOSTNAME ?? '127.0.0.1',
        },
    },
)
for (const signal of [
    'SIGINT',
    'SIGTERM',
])
    process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 0))
