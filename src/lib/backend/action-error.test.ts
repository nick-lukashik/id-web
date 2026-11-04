import { describe, expect, it, vi } from 'vitest'
import { actionError, actionErrorParam, backWithError, refused, signInAgainOn401 } from './action-error'

vi.mock('next/navigation', () => ({
    redirect: (url: string) => {
        throw new Error(`redirect ${url}`)
    },
}))

describe('actionError', () => {
    it('names a refusal by its status', () => {
        expect(actionError(403)).toBe('forbidden')
        expect(actionError(404)).toBe('not_found')
        expect(actionError(429)).toBe('rate_limited')
        expect(actionError(500)).toBe('unavailable')
        expect(actionError(503)).toBe('unavailable')
        expect(actionError(400)).toBe('failed')
        expect(actionError(409)).toBe('failed')
    })
})

describe('actionErrorParam', () => {
    it('knows only its own reasons', () => {
        expect(actionErrorParam('forbidden')).toBe('forbidden')
        expect(actionErrorParam('google_failed')).toBeUndefined()
        expect(actionErrorParam(undefined)).toBeUndefined()
        expect(
            actionErrorParam([
                'forbidden',
            ]),
        ).toBeUndefined()
    })
})

describe('refused', () => {
    it('sends a 401 to sign in again and back', () => {
        expect(() =>
            refused(
                {
                    status: 401,
                },
                '/notifications?show=60',
            ),
        ).toThrow('redirect /login?reauth=1&continue=%2Fnotifications%3Fshow%3D60')
    })

    it('goes back to the page with the reason', () => {
        expect(() =>
            refused(
                {
                    status: 503,
                },
                '/notifications?show=60',
            ),
        ).toThrow('redirect /notifications?show=60&error=unavailable')
        expect(() => backWithError('/account', 'failed')).toThrow('redirect /account?error=failed')
    })
})

describe('signInAgainOn401', () => {
    const ok = {
        status: 200,
    }

    it('sends to sign in again and back when any call got a 401', () => {
        expect(() =>
            signInAgainOn401('/wallet?show=40', ok, {
                status: 401,
            }),
        ).toThrow('redirect /login?reauth=1&continue=%2Fwallet%3Fshow%3D40')
    })

    it('leaves the rest to the page', () => {
        expect(
            signInAgainOn401('/wallet', ok, {
                status: 403,
            }),
        ).toBeUndefined()
        expect(
            signInAgainOn401('/wallet', ok, {
                status: 503,
            }),
        ).toBeUndefined()
    })
})
