import 'server-only'
import { serverEnv } from '@/lib/env/server'
import { seal, unseal } from './seal'

/** What the session cookie holds; never sent to browser JavaScript. */
export type Session = {
    accessToken: string
    /** ms since epoch */
    accessExpiresAt: number
    refreshToken: string
    sessionId: string
}

/** A sign-in in progress: the challenge of step 1, for step 2. */
export type PendingLogin = {
    challengeId: string
    email: string
    expiresAt: number
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
export const LOGIN_MAX_AGE = 60 * 10

/** `__Host-` needs Secure, so plain-http local runs use the bare names. */
export const cookieNames = (https: boolean) => ({
    session: https ? '__Host-id_session' : 'id_session',
    login: https ? '__Host-id_login' : 'id_login',
})

export const cookieOptions = (https: boolean, maxAge: number) => ({
    httpOnly: true,
    secure: https,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
})

export const sealSession = (session: Session) => seal(session, serverEnv.SESSION_SECRET, 'session')
export const openSession = (value: string | undefined) => unseal<Session>(value, serverEnv.SESSION_SECRET, 'session')
export const sealLogin = (login: PendingLogin) => seal(login, serverEnv.SESSION_SECRET, 'login')
export const openLogin = (value: string | undefined) => {
    const login = unseal<PendingLogin>(value, serverEnv.SESSION_SECRET, 'login')
    return login && login.expiresAt > Date.now() ? login : undefined
}

/** The token pair as id-api returns it → the cookie value. */
export function sessionFromTokens(tokens: {
    accessToken: string
    accessExpiresAt: string
    refreshToken: string
    sessionId: string
}): Session {
    return {
        accessToken: tokens.accessToken,
        accessExpiresAt: Date.parse(tokens.accessExpiresAt),
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
    }
}
