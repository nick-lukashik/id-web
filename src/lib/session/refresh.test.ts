import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// What the proxy sees: the raw request, with no request id from the edge.
vi.mock(import('next/headers'), () => ({
    headers: async () => new Headers() as never,
}))

vi.stubEnv('ID_API_URL', 'http://id-api.test')
const { refreshSession } = await import('./refresh')

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
})

const session = {
    accessToken: 'at.old',
    accessExpiresAt: 0,
    refreshToken: 'sid.old',
    sessionId: 'sid',
}

beforeEach(() => {
    fetchMock.mockReset()
})

describe('refreshSession', () => {
    it("reaches id-api with the proxy's request id", async () => {
        fetchMock.mockResolvedValue(
            Response.json({
                accessToken: 'at.new',
                accessExpiresAt: '2030-01-01T00:00:00.000Z',
                refreshToken: 'sid.new',
                sessionId: 'sid',
            }),
        )
        expect(await refreshSession(session, 'proxy-0123456789')).toEqual({
            accessToken: 'at.new',
            accessExpiresAt: Date.parse('2030-01-01T00:00:00.000Z'),
            refreshToken: 'sid.new',
            sessionId: 'sid',
        })
        const [url, init] = fetchMock.mock.calls[0] ?? []
        expect(url).toBe('http://id-api.test/api/v1/sessions/refresh')
        expect(init?.headers).toMatchObject({
            'x-request-id': 'proxy-0123456789',
        })
    })

    it('sends no request id when it has none', async () => {
        fetchMock.mockResolvedValue(
            new Response(null, {
                status: 401,
            }),
        )
        await refreshSession(session)
        expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('x-request-id')
    })

    it('tells an ended session from an unavailable id-api', async () => {
        for (const [status, answer] of [
            [
                401,
                'ended',
            ],
            [
                400,
                'ended',
            ],
            [
                503,
                'unavailable',
            ],
        ] as const) {
            fetchMock.mockResolvedValue(
                new Response(null, {
                    status,
                }),
            )
            expect(await refreshSession(session, 'proxy-0123456789')).toBe(answer)
        }
    })
})
