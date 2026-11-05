import 'server-only'
import { cookies } from 'next/headers'
import { backend } from '@/lib/backend/backend'
import { isHttps } from './current'
import {
    cookieNames,
    expiredCookie,
    expiredSessionCookie,
    openSession,
    SESSION_MAX_AGE,
    type SessionTokens,
    sealSession,
    sessionCookieOptions,
    sessionFromTokens,
} from './session'

/**
 * A sign-in succeeded (email code, passkey, Google): the tokens go into the
 * sealed session cookie, which every site under the domain reads, and the
 * pending sign-in is dropped. Signing in again while signed in (to confirm it is you)
 * replaces the previous session, which ends at id-api.
 */
export async function startSession(tokens: SessionTokens) {
    const https = isHttps()
    const jar = await cookies()
    const previous = openSession(jar.get(cookieNames(https).session)?.value)
    jar.set(
        cookieNames(https).session,
        sealSession(sessionFromTokens(tokens)),
        sessionCookieOptions(https, SESSION_MAX_AGE),
    )
    jar.set(cookieNames(https).login, '', expiredCookie(https))
    if (previous && previous.sessionId !== tokens.sessionId)
        await backend('id', '/api/v1/sessions/logout', {
            method: 'POST',
            body: {
                refreshToken: previous.refreshToken,
            },
        })
}

/**
 * Sign-out: the session ends at id-api, and with it the session of any site on
 * another domain signed in from it; then the cookie goes, for every site under
 * the domain. False when
 * id-api could not end it: the cookie stays and the person is told, since a page
 * saying "signed out" over a session that is still alive would be a lie.
 */
export async function endSession(): Promise<boolean> {
    const https = isHttps()
    const jar = await cookies()
    const session = openSession(jar.get(cookieNames(https).session)?.value)
    if (session) {
        const ended = await backend('id', '/api/v1/sessions/logout', {
            method: 'POST',
            body: {
                refreshToken: session.refreshToken,
            },
        })
        if (ended.status >= 500) return false
    }
    jar.set(cookieNames(https).session, '', expiredSessionCookie(https))
    return true
}

/** Where a sign-out that id-api could not do ends: the account, saying nothing has changed. */
export const SIGN_OUT_FAILED = '/account?error=unavailable'
