import 'server-only'
import { cookies } from 'next/headers'
import { backend } from '@/lib/backend/backend'
import { serverEnv } from '@/lib/env/server'
import { isHttps } from './current'
import { HINT_COOKIE, hintCookieOptions, hintDomain } from './hint'
import {
    cookieNames,
    cookieOptions,
    openSession,
    SESSION_MAX_AGE,
    type SessionTokens,
    sealSession,
    sessionFromTokens,
} from './session'

/**
 * A sign-in succeeded (email code, passkey, Google): the tokens go into the
 * sealed session cookie, the hint for the other sites is set, the pending
 * sign-in is dropped. Signing in again while signed in (to confirm it is you)
 * replaces the previous session, which ends at id-api.
 */
export async function startSession(tokens: SessionTokens) {
    const https = isHttps()
    const jar = await cookies()
    const previous = openSession(jar.get(cookieNames(https).session)?.value)
    jar.set(cookieNames(https).session, sealSession(sessionFromTokens(tokens)), cookieOptions(https, SESSION_MAX_AGE))
    jar.set(HINT_COOKIE, '1', hintCookieOptions(https, hintDomain(serverEnv.SITE_URL), SESSION_MAX_AGE))
    jar.delete(cookieNames(https).login)
    if (previous && previous.sessionId !== tokens.sessionId)
        await backend('id', '/api/v1/sessions/logout', {
            method: 'POST',
            body: {
                refreshToken: previous.refreshToken,
            },
        })
}

/** Signed out or the session ended: the cookie and the hint go. */
export async function endSession() {
    const https = isHttps()
    const jar = await cookies()
    jar.delete(cookieNames(https).session)
    jar.set(HINT_COOKIE, '', hintCookieOptions(https, hintDomain(serverEnv.SITE_URL), 0))
}
