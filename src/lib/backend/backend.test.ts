import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/** The browser's request; undefined: no request scope (startup, build). */
let incoming: Headers | undefined
vi.mock(import('next/headers'), () => ({
    headers: async () => {
        if (!incoming) throw new Error('`headers` was called outside a request scope')
        return incoming as never
    },
}))

vi.stubEnv('ID_API_URL', 'http://id-api.test')
const { backend } = await import('./backend')
const { logger } = await import('@/lib/logger')

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)
const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

beforeEach(() => {
    incoming = new Headers({
        'cf-connecting-ip': '203.0.113.7',
        'user-agent': `Mozilla/5.0 ${'x'.repeat(400)}`,
        'x-request-id': 'req-0123456789',
    })
    fetchMock.mockResolvedValue(Response.json({}))
})

/** The headers of the one call to fetch. */
const sent = () => {
    expect(fetchMock).toHaveBeenCalledOnce()
    return fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
}

describe('backend', () => {
    it("forwards the browser's address, user agent and request id", async () => {
        await backend('id', '/api/v1/me', {
            token: 'access-token',
        })
        expect(fetchMock.mock.calls[0]?.[0]).toBe('http://id-api.test/api/v1/me')
        expect(sent()).toEqual({
            accept: 'application/json',
            authorization: 'Bearer access-token',
            'x-forwarded-for': '203.0.113.7',
            'user-agent': `Mozilla/5.0 ${'x'.repeat(288)}`,
            'x-request-id': 'req-0123456789',
        })
    })

    it('keeps an address the caller gives', async () => {
        await backend('id', '/api/v1/login/email/start', {
            method: 'POST',
            body: {},
            clientIp: '198.51.100.1',
        })
        expect(sent()['x-forwarded-for']).toBe('198.51.100.1')
    })

    it('leaves out what the browser did not send or sent malformed', async () => {
        incoming = new Headers({
            'x-request-id': 'bad id',
        })
        await backend('id', '/api/v1/login/google/config')
        expect(sent()).toEqual({
            accept: 'application/json',
        })
    })

    it('works outside a request scope', async () => {
        incoming = undefined
        const result = await backend('id', '/api/v1/sessions/refresh', {
            method: 'POST',
            body: {
                refreshToken: 'sid.secret',
            },
        })
        expect(result).toMatchObject({
            ok: true,
            status: 200,
        })
        expect(sent()).toEqual({
            accept: 'application/json',
            'content-type': 'application/json',
        })
    })

    it('logs a network error in one line, without the body or the query', async () => {
        fetchMock.mockRejectedValue(
            new TypeError('fetch failed', {
                cause: Object.assign(new Error('connect ECONNREFUSED'), {
                    code: 'ECONNREFUSED',
                }),
            }),
        )
        const result = await backend('id', '/api/v1/login/email/verify?debug=1', {
            method: 'POST',
            token: 'access-token',
            body: {
                email: 'person@example.com',
                code: '123456',
            },
        })
        expect(result).toEqual({
            ok: false,
            status: 503,
            data: undefined,
            error: 'unavailable',
        })
        expect(logged).toHaveBeenCalledOnce()
        expect(logged.mock.calls[0]).toEqual([
            {
                api: 'id',
                method: 'POST',
                path: '/api/v1/login/email/verify',
                requestId: 'req-0123456789',
                error: 'TypeError',
                code: 'ECONNREFUSED',
            },
            'backend call failed',
        ])
    })

    it('logs a timeout', async () => {
        fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
        await backend('wallet', '/api/v1/me/wallet')
        expect(logged.mock.calls[0]?.[0]).toMatchObject({
            api: 'wallet',
            method: 'GET',
            path: '/api/v1/me/wallet',
            error: 'TimeoutError',
        })
    })
})
