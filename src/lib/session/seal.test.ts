import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { seal, unseal } = await import('./seal')

const SECRET = 'test-session-secret-0123456789abcdef'
const value = {
    accessToken: 'token',
    accessExpiresAt: 1,
    refreshToken: 'sid.random',
    sessionId: 'sid',
}

describe('seal', () => {
    it('opens what it sealed, with the same secret and purpose', () => {
        expect(unseal(seal(value, SECRET, 'session'), SECRET, 'session')).toEqual(value)
    })

    it('is opaque and different every time (random IV)', () => {
        const first = seal(value, SECRET, 'session')
        expect(first).not.toContain('token')
        expect(seal(value, SECRET, 'session')).not.toBe(first)
    })

    it('refuses another secret, another purpose and any change', () => {
        const sealed = seal(value, SECRET, 'session')
        expect(unseal(sealed, `${SECRET}x`, 'session')).toBeUndefined()
        // A login cookie cannot be replayed as a session cookie.
        expect(unseal(sealed, SECRET, 'login')).toBeUndefined()
        const flipped = `${sealed.slice(0, -2)}${sealed.at(-2) === 'A' ? 'B' : 'A'}${sealed.at(-1)}`
        expect(unseal(flipped, SECRET, 'session')).toBeUndefined()
    })

    it('refuses empty, garbage and oversized values', () => {
        expect(unseal(undefined, SECRET, 'session')).toBeUndefined()
        expect(unseal('', SECRET, 'session')).toBeUndefined()
        expect(unseal('not-sealed', SECRET, 'session')).toBeUndefined()
        expect(unseal('A'.repeat(5_000), SECRET, 'session')).toBeUndefined()
    })
})
