import { describe, expect, it } from 'vitest'
import { localeCookieOptions } from './config'

describe('the locale cookie', () => {
    it('is on the whole domain, for a subdomain and the root alike', () => {
        expect(localeCookieOptions(true, 'https://id.nick-lukashik.com').domain).toBe('nick-lukashik.com')
        expect(localeCookieOptions(true, 'https://nick-lukashik.com').domain).toBe('nick-lukashik.com')
    })

    it('has no Domain on localhost or an IP, where a browser would refuse it', () => {
        expect(localeCookieOptions(false, 'http://localhost:3000')).not.toHaveProperty('domain')
        expect(localeCookieOptions(false, 'http://127.0.0.1:3000')).not.toHaveProperty('domain')
    })
})
