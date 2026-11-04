import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

let incoming = new Headers()
vi.mock(import('next/headers'), () => ({
    headers: async () => incoming as never,
}))

const { clientIp } = await import('./current')

const ipOf = (values: Record<string, string>) => {
    incoming = new Headers(values)
    return clientIp()
}

describe('clientIp', () => {
    it("prefers Cloudflare's cf-connecting-ip", async () => {
        expect(
            await ipOf({
                'cf-connecting-ip': '203.0.113.7',
                'x-forwarded-for': '198.51.100.1, 10.42.0.5',
                'x-real-ip': '10.42.0.5',
            }),
        ).toBe('203.0.113.7')
        expect(
            await ipOf({
                'cf-connecting-ip': ' 2001:db8::7 ',
            }),
        ).toBe('2001:db8::7')
    })

    it('falls back to the first x-forwarded-for entry, then x-real-ip (local runs)', async () => {
        expect(
            await ipOf({
                'x-forwarded-for': '198.51.100.1, 10.42.0.5',
                'x-real-ip': '10.42.0.5',
            }),
        ).toBe('198.51.100.1')
        expect(
            await ipOf({
                'x-real-ip': '198.51.100.2',
            }),
        ).toBe('198.51.100.2')
        expect(await ipOf({})).toBeUndefined()
    })

    it('refuses anything but an IP', async () => {
        for (const value of [
            '',
            'unknown',
            'example.com',
            '203.0.113.7:443',
            '999.0.113.7',
            '203.0.113.7, 198.51.100.1',
            '<script>',
        ]) {
            expect(
                await ipOf({
                    'x-real-ip': value,
                }),
            ).toBeUndefined()
        }
    })

    it('does not fall back to what the browser sent when cf-connecting-ip is garbage', async () => {
        expect(
            await ipOf({
                'cf-connecting-ip': 'unknown',
                'x-forwarded-for': '198.51.100.1',
            }),
        ).toBeUndefined()
    })
})
