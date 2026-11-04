import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('GET /health/ready', () => {
    it('is ready with the version and no caching', async () => {
        vi.stubEnv('APP_VERSION', 'test')
        const { GET } = await import('./route')
        const response = GET()
        expect(response.status).toBe(200)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(await response.json()).toEqual({
            status: 'ok',
            version: 'test',
        })
        vi.unstubAllEnvs()
    })
})
