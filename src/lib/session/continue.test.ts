import { describe, expect, it } from 'vitest'
import { safeContinue } from './continue'

describe('safeContinue', () => {
    it('keeps paths of this site', () => {
        expect(safeContinue('/wallet?currency=USD')).toBe('/wallet?currency=USD')
        expect(safeContinue('/authorize?client_id=landing-web&state=s')).toBe(
            '/authorize?client_id=landing-web&state=s',
        )
    })

    it('refuses anything that leaves it', () => {
        for (const value of [
            'https://evil.test/',
            '//evil.test/',
            '/\\evil.test',
            'javascript:alert(1)',
            '',
            undefined,
            42,
        ]) {
            expect(safeContinue(value)).toBe('/account')
        }
    })
})
