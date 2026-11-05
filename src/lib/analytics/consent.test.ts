import { describe, expect, it } from 'vitest'
import { consentCookieOptions, consentDomain, consentPressed } from './consent'

describe('consentDomain', () => {
    it('is the registered domain for a subdomain and the root alike', () => {
        expect(consentDomain('https://id.example.com')).toBe('example.com')
        expect(consentDomain('https://example.com')).toBe('example.com')
    })

    it('is none for localhost and an IP', () => {
        expect(consentDomain('http://localhost:3000')).toBeUndefined()
        expect(consentDomain('http://127.0.0.1:3000')).toBeUndefined()
        expect(consentDomain('http://[::1]:3000')).toBeUndefined()
    })
})

describe('consentPressed', () => {
    it('is true only for what "OK" sets, so an answer of the old banner shows the new one', () => {
        expect(consentPressed('true')).toBe(true)
        expect(consentPressed('granted')).toBe(false)
        expect(consentPressed('denied')).toBe(false)
        expect(consentPressed(undefined)).toBe(false)
    })
})

describe('consentCookieOptions', () => {
    it('covers the whole domain, for a year, over https', () => {
        expect(consentCookieOptions('https://id.example.com')).toMatchObject({
            domain: 'example.com',
            secure: true,
            path: '/',
            maxAge: 31_536_000,
        })
    })

    it('stays on this host when there is no domain', () => {
        const options = consentCookieOptions('http://localhost:3000')
        expect(options).not.toHaveProperty('domain')
        expect(options.secure).toBe(false)
    })
})
