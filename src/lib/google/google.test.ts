import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { googleError, readPending, sameOwner, startGoogle } = await import('./google')

const config = {
    authorizationEndpoint: 'https://accounts.google.test/o/oauth2/v2/auth',
    clientId: 'client.apps.googleusercontent.com',
    redirectUri: 'https://id.example.com/login/google/callback',
}
const owner = {
    userId: '0b7f2f4e-4a8e-4d36-9d7c-3f1f6a1c2b10',
    sessionId: '6c1d0a52-9e43-4b8f-a2a1-7d5e3c9b8f21',
}

describe('startGoogle', () => {
    it('seals who started a link with the pending request', () => {
        const { cookie } = startGoogle(config, 'link', '/account', owner)
        expect(readPending(cookie)).toMatchObject({
            intent: 'link',
            owner,
        })
        expect(readPending(startGoogle(config, 'login', '/account').cookie)?.owner).toBeUndefined()
    })
})

describe('sameOwner', () => {
    it('is the same user in the same session only', () => {
        expect(
            sameOwner(owner, {
                ...owner,
            }),
        ).toBe(true)
        expect(
            sameOwner(owner, {
                ...owner,
                sessionId: 'a3e9c1f0-5b2d-4e7a-8c6f-1d0b9a8e7c54',
            }),
        ).toBe(false)
        expect(
            sameOwner(owner, {
                ...owner,
                userId: 'f4d3c2b1-a098-4765-8432-10fedcba9876',
            }),
        ).toBe(false)
        expect(sameOwner(undefined, owner)).toBe(false)
    })
})

describe('googleError', () => {
    it('tells an older session to sign in again, apart from a suspended account', () => {
        expect(
            googleError({
                status: 403,
                error: 'reauthentication_required',
            }),
        ).toBe('google_reauth_required')
        expect(
            googleError({
                status: 403,
                error: 'FORBIDDEN',
            }),
        ).toBe('google_suspended')
    })
})
