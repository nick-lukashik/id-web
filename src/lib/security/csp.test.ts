import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCsp, createNonce, STYLE_HASHES } from './csp'

const directive = (csp: string, name: string) =>
    csp
        .split('; ')
        .find(part => part.startsWith(`${name} `))
        ?.slice(name.length + 1)

describe('buildCsp', () => {
    it('keeps the browser on this origin unless Tag Manager is on', () => {
        const csp = buildCsp({
            nonce: 'abc123',
        })
        expect(csp).not.toContain('google')
        const on = buildCsp({
            nonce: 'abc123',
            analytics: true,
        })
        expect(directive(on, 'connect-src')).toContain('https://*.google-analytics.com')
        expect(directive(on, 'img-src')).toContain('https://*.google-analytics.com')
        // Scripts stay nonce-only: the container comes through 'strict-dynamic'.
        expect(directive(on, 'script-src')).toBe("'self' 'nonce-abc123' 'strict-dynamic'")
    })

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

    it('allows exactly the stylesheet the installed sonner injects', () => {
        const source = readFileSync('node_modules/sonner/dist/index.mjs', 'utf8')
        const literal = source.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)?.[1]
        expect(literal, 'sonner no longer calls __insertCSS: recheck its CSP needs').toBeDefined()
        const css: string = JSON.parse(literal ?? '""')
        const hash = createHash('sha256').update(css).digest('base64')
        expect(STYLE_HASHES, 'update STYLE_HASHES in csp.ts').toContain(`'sha256-${hash}'`)
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

    it('lets forms lead only here, and to the origins given', () => {
        expect(
            directive(
                buildCsp({
                    nonce: 'n',
                }),
                'form-action',
            ),
        ).toBe("'self'")
        expect(
            directive(
                buildCsp({
                    nonce: 'n',
                    formActions: [
                        'https://nick-lukashik.com',
                    ],
                }),
                'form-action',
            ),
        ).toBe("'self' https://nick-lukashik.com")
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
