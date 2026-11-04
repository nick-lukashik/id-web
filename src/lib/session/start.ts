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

/**
 * Sign-out: the session ends at id-api, and with it every other site's
 * session signed in from it; then the cookie and the hint go here. Sign-out
 * on any site of the platform is sign-out everywhere in this browser.
 */
export async function endSession() {
    const https = isHttps()
    const jar = await cookies()
    const session = openSession(jar.get(cookieNames(https).session)?.value)
    if (session)
        await backend('id', '/api/v1/sessions/logout', {
            method: 'POST',
            body: {
                refreshToken: session.refreshToken,
            },
        })
    jar.delete(cookieNames(https).session)
    jar.set(HINT_COOKIE, '', hintCookieOptions(https, hintDomain(serverEnv.SITE_URL), 0))
}

/**
 * Where a site sends the browser back after sign-out: a URL on one of the
 * platform's sites (FORM_ACTION_ORIGINS), or undefined.
 */
export function siteReturn(value: unknown): string | undefined {
    if (typeof value !== 'string' || !URL.canParse(value)) return undefined
    const url = new URL(value)
    return serverEnv.FORM_ACTION_ORIGINS.includes(url.origin) ? url.toString() : undefined
}
