import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const SECRET = 'test-session-secret-0123456789abcdef'

async function load(env: Record<string, string>) {
    vi.resetModules()
    vi.stubEnv('SESSION_SECRET', SECRET)
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    return (await import('./server')).serverEnv
}

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('serverEnv', () => {
    it('falls back to local defaults for unset or blank values', async () => {
        const env = await load({
            SITE_URL: ' ',
            APP_VERSION: '',
            LOG_LEVEL: '',
            ROBOTS: '',
        })
        expect(env).toMatchObject({
            SITE_URL: 'http://localhost:3000',
            APP_VERSION: 'dev',
            LOG_LEVEL: 'info',
            ROBOTS: 'index',
        })
    })

    it('reads ROBOTS at runtime', async () => {
        const env = await load({
            ROBOTS: 'noindex',
        })
        expect(env.ROBOTS).toBe('noindex')
    })

    it('drops trailing slashes', async () => {
        const env = await load({
            SITE_URL: 'https://example.com//',
        })
        expect(env.SITE_URL).toBe('https://example.com')
    })

    it('points at the cluster services by default', async () => {
        const env = await load({})
        expect(env).toMatchObject({
            ID_API_URL: 'http://id-api.prod.svc',
            WALLET_API_URL: 'http://wallet-api.prod.svc',
            PAY_API_URL: 'http://pay-api.prod.svc',
            NOTIFICATIONS_API_URL: 'http://notifications-api.prod.svc',
        })
    })

    it('needs a session secret of at least 32 characters', async () => {
        await expect(
            load({
                SESSION_SECRET: 'short',
            }),
        ).rejects.toThrow(/SESSION_SECRET/)
    })

    it('names every invalid variable', async () => {
        await expect(
            load({
                SITE_URL: 'not a url',
                LOG_LEVEL: 'loud',
                ROBOTS: 'maybe',
            }),
        ).rejects.toThrow(/Invalid server environment[\s\S]*SITE_URL[\s\S]*LOG_LEVEL[\s\S]*ROBOTS/)
    })
})
