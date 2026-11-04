import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backend } from './backend'
import { loadList, MAX_SHOWN, shownParam, withShown } from './list'

vi.mock('server-only', () => ({}))
vi.mock('./backend', () => ({
    backend: vi.fn(),
}))

const call = vi.mocked(backend)
const ok = (items: number[], nextCursor: string | null, extra = {}) => ({
    ok: true,
    status: 200,
    data: {
        items,
        nextCursor,
        ...extra,
    },
})
const down = {
    ok: false,
    status: 503,
    data: undefined,
    error: 'unavailable',
}
const paths = () => call.mock.calls.map(([, path]) => path)
const range = (length: number) =>
    Array.from(
        {
            length,
        },
        (_, i) => i,
    )

beforeEach(() => {
    call.mockReset()
})

describe('loadList', () => {
    it('asks for as many as it shows in one call, and says whether there are more', async () => {
        // A full page has a cursor (the APIs fetch one row more to know).
        call.mockResolvedValueOnce(
            ok(range(30), 'c1', {
                unreadCount: 5,
            }),
        )
        const list = await loadList<
            number,
            {
                unreadCount: number
            }
        >('notifications', '/api/v1/x', 'at', 30)
        expect(paths()).toEqual([
            '/api/v1/x?limit=30',
        ])
        expect(call.mock.calls[0]?.[2]).toEqual({
            token: 'at',
        })
        expect(list.items).toEqual(range(30))
        expect(list).toMatchObject({
            more: true,
            incomplete: false,
        })
        expect(list.first?.unreadCount).toBe(5)
    })

    it('follows nextCursor in calls of at most 100 until it has enough', async () => {
        call.mockResolvedValueOnce(ok(range(100), 'c1')).mockResolvedValueOnce(
            ok(
                [
                    100,
                ],
                null,
            ),
        )
        const list = await loadList<number>('pay', '/api/v1/x', 'at', 150)
        expect(paths()).toEqual([
            '/api/v1/x?limit=100',
            '/api/v1/x?limit=50&cursor=c1',
        ])
        expect(list.items).toHaveLength(101)
        expect(list.more).toBe(false)
    })

    it('has nothing to show when the first call fails', async () => {
        call.mockResolvedValueOnce(down)
        expect(await loadList('wallet', '/api/v1/x', 'at', 20)).toEqual({
            first: undefined,
            items: [],
            more: false,
            incomplete: false,
        })
    })

    it('keeps what loaded when a later call fails', async () => {
        call.mockResolvedValueOnce(ok(range(100), 'c1')).mockResolvedValueOnce(down)
        const list = await loadList<number>('pay', '/api/v1/x', 'at', 120)
        expect(list.first).toBeDefined()
        expect(list.items).toHaveLength(100)
        expect(list).toMatchObject({
            more: true,
            incomplete: true,
        })
    })

    it('stops at an empty page even if it has a cursor', async () => {
        call.mockResolvedValue(ok([], 'again'))
        const list = await loadList('pay', '/api/v1/x', 'at', 200)
        expect(call).toHaveBeenCalledTimes(1)
        expect(list.more).toBe(false)
    })
})

describe('shownParam', () => {
    it('reads a whole number from one page up to the most a page shows', () => {
        expect(shownParam('40', 20)).toBe(40)
        expect(
            shownParam(
                [
                    '60',
                ],
                30,
            ),
        ).toBe(60)
        expect(shownParam(String(MAX_SHOWN), 20)).toBe(MAX_SHOWN)
    })

    it('falls back to one page for anything else', () => {
        for (const value of [
            undefined,
            null,
            '',
            '10',
            '40.5',
            'many',
            String(MAX_SHOWN + 1),
            [
                '40',
                '60',
            ],
        ])
            expect(shownParam(value, 20)).toBe(20)
    })
})

describe('withShown', () => {
    it('adds ?show= only past the first page', () => {
        expect(withShown('/payments', 20, 20)).toBe('/payments')
        expect(withShown('/payments', 40, 20)).toBe('/payments?show=40')
        expect(withShown('/wallet?currency=USD', 40, 20)).toBe('/wallet?currency=USD&show=40')
    })
})
