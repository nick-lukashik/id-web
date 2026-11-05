import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

/** The module of a site served at `siteUrl` (env is read on import). */
async function load(siteUrl: string) {
    vi.resetModules()
    vi.stubEnv('SITE_URL', siteUrl)
    return import('./session')
}

describe('the session cookie', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('goes to every site under the domain, from the account site', async () => {
        const { cookieNames, expiredSessionCookie, sessionCookieOptions } = await load('https://id.nick-lukashik.com')
        expect(cookieNames(true).session).toBe('__Secure-nl_session')
        expect(sessionCookieOptions(true, 60)).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60,
            domain: 'nick-lukashik.com',
        })
        expect(expiredSessionCookie(true)).toMatchObject({
            domain: 'nick-lukashik.com',
            maxAge: 0,
        })
    })

    it('has no Domain on localhost, where the port does not matter to a cookie', async () => {
        const { cookieNames, sessionCookieOptions } = await load('http://localhost:3000')
        expect(cookieNames(false).session).toBe('nl_session')
        expect(sessionCookieOptions(false, 60)).not.toHaveProperty('domain')
    })

    it('keeps the cookies of a sign-in on this site alone', async () => {
        const { cookieNames } = await load('https://id.nick-lukashik.com')
        expect(cookieNames(true).login).toBe('__Host-id_login')
    })
})
