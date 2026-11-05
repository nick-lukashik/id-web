import { describe, expect, it } from 'vitest'
import { consentAnswer, consentCookieOptions, consentDomain } from './consent'

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

describe('consentAnswer', () => {
    it('knows the two answers and nothing else', () => {
        expect(consentAnswer('granted')).toBe('granted')
        expect(consentAnswer('denied')).toBe('denied')
        expect(consentAnswer('yes')).toBeUndefined()
        expect(consentAnswer(undefined)).toBeUndefined()
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
