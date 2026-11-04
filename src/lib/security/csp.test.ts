import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce, STYLE_HASHES } from './csp'

const directive = (csp: string, name: string) =>
    csp
        .split('; ')
        .find(part => part.startsWith(`${name} `))
        ?.slice(name.length + 1)

describe('buildCsp', () => {
    it('allows scripts only with the nonce in production', () => {
        const csp = buildCsp({
            nonce: 'abc123',
        })
        const scripts = directive(csp, 'script-src')
        expect(scripts).toBe("'self' 'nonce-abc123' 'strict-dynamic'")
        expect(scripts).not.toContain('unsafe-inline')
        expect(scripts).not.toContain('unsafe-eval')
        expect(directive(csp, 'style-src')).toBe(
            [
                "'self'",
                "'nonce-abc123'",
                ...STYLE_HASHES,
            ].join(' '),
        )
        expect(csp).not.toContain('unsafe-inline')
    })

    it('locks down framing, plugins, base and other origins', () => {
        const csp = buildCsp({
            nonce: 'n',
        })
        expect(directive(csp, 'connect-src')).toBe("'self'")
        expect(directive(csp, 'frame-ancestors')).toBe("'none'")
        expect(directive(csp, 'object-src')).toBe("'none'")
        expect(directive(csp, 'base-uri')).toBe("'none'")
        expect(csp).not.toContain('upgrade-insecure-requests')
    })

    it('relaxes only what next dev needs', () => {
        const csp = buildCsp({
            nonce: 'n',
            dev: true,
        })
        expect(directive(csp, 'script-src')).toContain("'unsafe-eval'")
        expect(directive(csp, 'script-src')).not.toContain('unsafe-inline')
        expect(directive(csp, 'style-src')).toBe("'self' 'unsafe-inline'")
        expect(directive(csp, 'connect-src')).toBe("'self' ws: wss:")
    })

    it('upgrades insecure requests behind TLS', () => {
        expect(
            buildCsp({
                nonce: 'n',
                https: true,
            }),
        ).toMatch(/; upgrade-insecure-requests$/)
    })
})

describe('createNonce', () => {
    it('is base64 and unique per call', () => {
        const a = createNonce()
        expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/)
        expect(createNonce()).not.toBe(a)
    })
})
