import 'server-only'
import { consentDomain } from '@/lib/analytics/consent'
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

/** A sign-in in progress: the challenge of step 1, for step 2, and where to go after it. */
export type PendingLogin = {
    challengeId: string
    email: string
    expiresAt: number
    /** ms since epoch: id-api sends no new code for this email before it. */
    resendAfter: number
    continueTo?: string
    /** Signing in again while signed in, to confirm it is you. */
    reauth?: boolean
}

/** The token pair as id-api returns it. */
export type SessionTokens = {
    accessToken: string
    accessExpiresAt: string
    refreshToken: string
    sessionId: string
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30
export const LOGIN_MAX_AGE = 60 * 10

/**
 * `__Host-` and `__Secure-` need Secure, so plain-http local runs use the bare names.
 * The session is one cookie for every site under the domain, and `__Host-` allows no
 * Domain; the others belong to a sign-in on this site alone.
 */
export const cookieNames = (https: boolean) => ({
    session: https ? '__Secure-nl_session' : 'nl_session',
    login: https ? '__Host-id_login' : 'id_login',
    google: https ? '__Host-id_google' : 'id_google',
    passkey: https ? '__Host-id_passkey' : 'id_passkey',
})

export const cookieOptions = (https: boolean, maxAge: number) => ({
    httpOnly: true,
    secure: https,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
})

/**
 * What expires a cookie: the attributes it was set with. `cookies().delete()`
 * sends no Secure, and a browser ignores a Set-Cookie for a `__Host-` name
 * without it, so such a cookie would simply stay.
 */
export const expiredCookie = (https: boolean) => cookieOptions(https, 0)

/** The session cookie: every site under the registered domain reads it; no Domain on localhost or an IP. */
export const sessionCookieOptions = (https: boolean, maxAge: number) => {
    const domain = consentDomain(serverEnv.SITE_URL)
    return {
        ...cookieOptions(https, maxAge),
        ...(domain
            ? {
                  domain,
              }
            : {}),
    }
}

/** A browser only expires a cookie with the Domain it was set with. */
export const expiredSessionCookie = (https: boolean) => sessionCookieOptions(https, 0)

export const sealSession = (session: Session) => seal(session, serverEnv.SESSION_SECRET, 'session')
export const openSession = (value: string | undefined) => unseal<Session>(value, serverEnv.SESSION_SECRET, 'session')
export const sealLogin = (login: PendingLogin) => seal(login, serverEnv.SESSION_SECRET, 'login')
export const openLogin = (value: string | undefined) => {
    const login = unseal<PendingLogin>(value, serverEnv.SESSION_SECRET, 'login')
    return login && login.expiresAt > Date.now() ? login : undefined
}

/** The token pair as id-api returns it → the cookie value. */
export function sessionFromTokens(tokens: SessionTokens): Session {
    return {
        accessToken: tokens.accessToken,
        accessExpiresAt: Date.parse(tokens.accessExpiresAt),
        refreshToken: tokens.refreshToken,
        sessionId: tokens.sessionId,
    }
}
