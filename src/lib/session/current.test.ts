import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

let incoming = new Headers()
vi.mock(import('next/headers'), () => ({
    headers: async () => incoming as never,
}))

/** clientIp() of a site served at `siteUrl` (env is read on import). */
async function load(siteUrl: string) {
    vi.resetModules()
    vi.stubEnv('SITE_URL', siteUrl)
    const { clientIp } = await import('./current')
    return (values: Record<string, string>) => {
        incoming = new Headers(values)
        return clientIp()
    }
}

const ipOf = await load('http://localhost:3100')
const behindCloudflare = await load('https://id.example.com')

afterAll(() => {
    vi.unstubAllEnvs()
})

describe('clientIp', () => {
    it("prefers Cloudflare's cf-connecting-ip", async () => {
        for (const read of [
            ipOf,
            behindCloudflare,
        ]) {
            expect(
                await read({
                    'cf-connecting-ip': '203.0.113.7',
                    'x-forwarded-for': '198.51.100.1, 10.42.0.5',
                    'x-real-ip': '10.42.0.5',
                }),
            ).toBe('203.0.113.7')
            expect(
                await read({
                    'cf-connecting-ip': ' 2001:db8::7 ',
                }),
            ).toBe('2001:db8::7')
        }
    })

    it('falls back to the first x-forwarded-for entry, then x-real-ip, in local runs', async () => {
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

    it('checks each one in turn, so a malformed x-forwarded-for still falls back to x-real-ip', async () => {
        for (const forwarded of [
            'unknown',
            'unknown, 198.51.100.1',
            '',
            ' , 198.51.100.1',
        ]) {
            expect(
                await ipOf({
                    'x-forwarded-for': forwarded,
                    'x-real-ip': ' 198.51.100.2 ',
                }),
            ).toBe('198.51.100.2')
        }
        expect(
            await ipOf({
                'x-forwarded-for': 'unknown',
                'x-real-ip': 'unknown',
            }),
        ).toBeUndefined()
    })

    it('reads nothing the browser can set over HTTPS', async () => {
        expect(
            await behindCloudflare({
                'x-forwarded-for': '198.51.100.1',
                'x-real-ip': '198.51.100.2',
            }),
        ).toBeUndefined()
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
            expect(
                await behindCloudflare({
                    'cf-connecting-ip': value,
                }),
            ).toBeUndefined()
        }
    })

    it('does not fall back when cf-connecting-ip is garbage', async () => {
        expect(
            await ipOf({
                'cf-connecting-ip': 'unknown',
                'x-forwarded-for': '198.51.100.1',
            }),
        ).toBeUndefined()
    })
})
