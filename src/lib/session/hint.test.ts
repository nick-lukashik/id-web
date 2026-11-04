import { describe, expect, it } from 'vitest'
import { hintDomain } from './hint'

describe('hintDomain', () => {
    it('is the parent domain of the identity host', () => {
        expect(hintDomain('https://id.nick-lukashik.com')).toBe('nick-lukashik.com')
        expect(hintDomain('https://id.nick-lukashik.test')).toBe('nick-lukashik.test')
    })

    it('is none on localhost, an IP or a bare domain', () => {
        expect(hintDomain('http://localhost:3100')).toBeUndefined()
        expect(hintDomain('http://127.0.0.1:3100')).toBeUndefined()
        expect(hintDomain('http://[::1]:3100')).toBeUndefined()
        expect(hintDomain('https://nick-lukashik.com')).toBeUndefined()
    })
})
