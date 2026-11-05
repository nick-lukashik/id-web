import { describe, expect, it, vi } from 'vitest'
import { safeContinue, siteReturn } from './continue'

vi.mock('server-only', () => ({}))

describe('safeContinue', () => {
    it('keeps paths of this site', () => {
        expect(safeContinue('/wallet?currency=USD')).toBe('/wallet?currency=USD')
        expect(safeContinue('/authorize?client_id=landing-web&state=s')).toBe(
            '/authorize?client_id=landing-web&state=s',
        )
    })

    it("keeps a page of the platform's sites", () => {
        expect(safeContinue('https://nick-lukashik.com/privacy?lang=ru')).toBe(
            'https://nick-lukashik.com/privacy?lang=ru',
        )
        expect(siteReturn('https://nick-lukashik.com/')).toBe('https://nick-lukashik.com/')
        expect(siteReturn('https://nick-lukashik.com.evil.test/')).toBeUndefined()
        expect(siteReturn('/account')).toBeUndefined()
    })

    it('refuses anything that leaves it', () => {
        for (const value of [
            'https://evil.test/',
            '//evil.test/',
            '/\\evil.test',
            // The URL parser turns these into //evil.test.
            '/.//evil.test/x',
            '/..//evil.test/x',
            '/%2e//evil.test/x',
            '/./\t/evil.test/x',
            'javascript:alert(1)',
            '',
            undefined,
            42,
        ]) {
            expect(safeContinue(value)).toBe('/account')
        }
    })
})
