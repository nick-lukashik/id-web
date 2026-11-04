import { type NextRequest, NextResponse } from 'next/server'
import { LOCALE_COOKIE, LOCALE_HEADER, LOCALE_PARAM, localeCookieOptions } from '@/i18n/config'
import { resolveLocale } from '@/i18n/resolve'
import { serverEnv } from '@/lib/env/server'
import { REQUEST_ID_HEADER, requestIdFrom } from '@/lib/request-id'
import { buildCsp, createNonce, NONCE_HEADER } from '@/lib/security/csp'
import { CANONICAL_HEADER, canonicalPath, PATHNAME_HEADER } from '@/lib/seo/alternates'
import { HINT_COOKIE, hintCookieOptions, hintDomain } from '@/lib/session/hint'
import { REFRESH_BEFORE_MS, refreshSession } from '@/lib/session/refresh'
import { cookieNames, cookieOptions, openSession, SESSION_MAX_AGE, sealSession } from '@/lib/session/session'

// Read at runtime: the same image reports what the deploy sets.
const version = process.env.APP_VERSION || 'dev'

/** Probes: no CSP, no locale. */
const isMachinePath = (path: string) => path.startsWith('/health/')

/**
 * Every request but /api: a request id (kept from the edge or new) and the app
 * version. Pages also get a per-request CSP nonce, the resolved locale
 * (?lang= > cookie > Accept-Language) and their path for metadata.
 */
export async function proxy(request: NextRequest) {
    const requestId = requestIdFrom(request.headers.get(REQUEST_ID_HEADER))
    // Before the headers are copied: the page renders with the refreshed cookie.
    const session = isMachinePath(request.nextUrl.pathname) ? undefined : await keepSessionFresh(request, requestId)
    const forwarded = new Headers(request.headers)
    forwarded.set(REQUEST_ID_HEADER, requestId)

    const { pathname, searchParams, protocol } = request.nextUrl
    const page = !isMachinePath(pathname)
    const https = request.headers.get('x-forwarded-proto') === 'https' || protocol === 'https:'

    let csp: string | undefined
    let persistLocale: string | undefined
    if (page) {
        const nonce = createNonce()
        csp = buildCsp({
            nonce,
            dev: process.env.NODE_ENV === 'development',
            https,
            formActions: serverEnv.FORM_ACTION_ORIGINS,
        })
        // Next.js reads the nonce from the request's CSP and puts it on its scripts.
        forwarded.set('content-security-policy', csp)
        forwarded.set(NONCE_HEADER, nonce)

        const locale = resolveLocale({
            query: searchParams.get(LOCALE_PARAM),
            cookie: request.cookies.get(LOCALE_COOKIE)?.value,
            acceptLanguage: request.headers.get('accept-language'),
        })
        forwarded.set(LOCALE_HEADER, locale.locale)
        forwarded.set(PATHNAME_HEADER, pathname)
        forwarded.set(CANONICAL_HEADER, canonicalPath(pathname, locale.locale, locale.source === 'query'))
        if (locale.persist) persistLocale = locale.locale
    }

    const response = NextResponse.next({
        request: {
            headers: forwarded,
        },
    })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    response.headers.set('x-app-version', version)
    const secure = serverEnv.SITE_URL.startsWith('https://')
    const sessionCookie = cookieNames(secure).session
    const hint = (maxAge: number) =>
        response.cookies.set(
            HINT_COOKIE,
            maxAge > 0 ? '1' : '',
            hintCookieOptions(secure, hintDomain(serverEnv.SITE_URL), maxAge),
        )
    if (session === 'clear') {
        response.cookies.delete(sessionCookie)
        if (request.cookies.has(HINT_COOKIE)) hint(0)
    } else if (session) {
        response.cookies.set(sessionCookie, session, cookieOptions(secure, SESSION_MAX_AGE))
        hint(SESSION_MAX_AGE)
    } else if (request.cookies.has(sessionCookie) && !request.cookies.has(HINT_COOKIE) && !isMachinePath(pathname)) {
        // A session from before the hint existed.
        hint(SESSION_MAX_AGE)
    }
    if (csp) response.headers.set('content-security-policy', csp)
    if (persistLocale) {
        response.cookies.set(LOCALE_COOKIE, persistLocale, localeCookieOptions(https))
    }
    return response
}

/**
 * Refreshes the access token of the session cookie when it is about to
 * expire: the new cookie goes to the page (request) and to the browser
 * (response). Returns the new sealed value, 'clear' when the session ended,
 * or undefined when nothing changes. Parallel requests of one page may each
 * refresh: id-api answers the previous token with the same new one.
 */
async function keepSessionFresh(request: NextRequest, requestId: string): Promise<string | 'clear' | undefined> {
    const name = cookieNames(serverEnv.SITE_URL.startsWith('https://')).session
    const sealed = request.cookies.get(name)?.value
    if (!sealed) return undefined
    const session = openSession(sealed)
    if (!session) {
        request.cookies.delete(name)
        return 'clear'
    }
    if (session.accessExpiresAt - Date.now() > REFRESH_BEFORE_MS) return undefined
    const refreshed = await refreshSession(session, requestId)
    if (refreshed === 'unavailable') return undefined
    if (refreshed === 'ended') {
        request.cookies.delete(name)
        return 'clear'
    }
    const value = sealSession(refreshed)
    request.cookies.set(name, value)
    return value
}

export const config = {
    // Everything but build assets, the image optimizer and the /api proxy,
    // prefetches included: a prefetched page may be the one shown, so it
    // needs its CSP too. /api is left out because Next.js buffers the body of
    // every request the proxy runs for (up to 10 MB, until it has all of it);
    // the route handler sets the request id and version there itself.
    matcher: [
        '/((?!_next/static/|_next/image|api/).*)',
    ],
}
