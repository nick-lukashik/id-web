import { type Route } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { LOCALE_COOKIE } from '@/i18n/config'
import { backend } from '@/lib/backend/backend'
import { type GoogleError, googleError, readPending, sameOwner, sameState } from '@/lib/google/google'
import { clientIp, currentSession, isHttps } from '@/lib/session/current'
import { cookieNames, type SessionTokens } from '@/lib/session/session'
import { startSession } from '@/lib/session/start'

export const dynamic = 'force-dynamic'

/**
 * Google comes back here (the redirect URI registered at Google). The state
 * must match the pending request; the code goes to id-api once, with the
 * PKCE verifier and the nonce. A link goes only to the user and session that
 * started it: another account signed in meanwhile (another tab) gets nothing.
 * The pending cookie goes whatever happens.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const jar = await cookies()
    const name = cookieNames(isHttps()).google
    const pending = readPending(jar.get(name)?.value)
    jar.delete(name)

    const fail = (error: GoogleError): never =>
        redirect(
            (pending?.intent === 'link'
                ? `/account?error=${error}`
                : `/login?error=${error}&continue=${encodeURIComponent(pending?.continueTo ?? '/account')}`) as Route,
        )

    if (!pending || !sameState(params.get('state'), pending.state)) return fail('google_failed')
    if (params.get('error')) return fail('google_cancelled')
    const code = params.get('code')
    if (!code) return fail('google_failed')
    const exchange = {
        code,
        codeVerifier: pending.verifier,
        nonce: pending.nonce,
    }

    if (pending.intent === 'link') {
        const session = await currentSession()
        if (!session) redirect('/login?error=google_failed&continue=%2Faccount')
        const me = await backend<{
            id: string
        }>('id', '/api/v1/me', {
            token: session.accessToken,
        })
        if (!me.data) return fail(googleError(me))
        if (
            !sameOwner(pending.owner, {
                userId: me.data.id,
                sessionId: session.sessionId,
            })
        )
            return fail('google_session_changed')
        const linked = await backend('id', '/api/v1/me/identities/google', {
            method: 'POST',
            token: session.accessToken,
            body: exchange,
        })
        if (!linked.ok) return fail(googleError(linked))
        redirect('/account?linked=google')
    }

    const result = await backend<SessionTokens>('id', '/api/v1/login/google', {
        method: 'POST',
        body: {
            ...exchange,
            locale: jar.get(LOCALE_COOKIE)?.value === 'ru' ? 'ru' : 'en',
        },
        clientIp: await clientIp(),
    })
    if (!result.ok || !result.data) return fail(googleError(result))
    await startSession(result.data)
    redirect(pending.continueTo as Route)
}
