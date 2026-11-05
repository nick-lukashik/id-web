import { describe, expect, it } from 'vitest'
import { legalLinks } from './links'

describe('legalLinks', () => {
    it('points at the main site of this domain', () => {
        expect(legalLinks('https://id.nick-lukashik.com')).toEqual({
            privacy: 'https://nick-lukashik.com/privacy',
            terms: 'https://nick-lukashik.com/terms',
        })
    })

    it('keeps the domain of another environment', () => {
        expect(legalLinks('https://id.nick-lukashik.test').terms).toBe('https://nick-lukashik.test/terms')
    })

    it('points at prod from localhost and an IP', () => {
        expect(legalLinks('http://localhost:3000').privacy).toBe('https://nick-lukashik.com/privacy')
        expect(legalLinks('http://127.0.0.1:3000').terms).toBe('https://nick-lukashik.com/terms')
    })
})
