import { type NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend/backend'
import { GOOGLE_MAX_AGE, type GoogleConfig, type GoogleIntent, startGoogle } from '@/lib/google/google'
import { safeContinue } from '@/lib/session/continue'
import { isHttps } from '@/lib/session/current'
import { cookieNames, cookieOptions } from '@/lib/session/session'

export const dynamic = 'force-dynamic'

/**
 * Sends the browser to Google (a link, not a form: CSP form-action would stop
 * a form's redirect to Google before JavaScript loads). `intent=link` links
 * Google to the signed-in account instead of signing in.
 */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams
    const intent: GoogleIntent = params.get('intent') === 'link' ? 'link' : 'login'
    const continueTo = safeContinue(params.get('continue'))
    const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl), 303)
    const unavailable = () =>
        to(
            intent === 'link'
                ? '/account?error=google_unavailable'
                : `/login?error=google_unavailable&continue=${encodeURIComponent(continueTo)}`,
        )

    const config = await backend<GoogleConfig>('id', '/api/v1/login/google/config')
    const endpoint = config.data?.authorizationEndpoint
    if (
        !config.data?.enabled
        || !config.data.clientId
        || !config.data.redirectUri
        || !endpoint
        || !/^https?:\/\//.test(endpoint)
    )
        return unavailable()

    const { url, cookie } = startGoogle(
        {
            authorizationEndpoint: endpoint,
            clientId: config.data.clientId,
            redirectUri: config.data.redirectUri,
        },
        intent,
        continueTo,
    )
    const response = NextResponse.redirect(url, 303)
    response.cookies.set(cookieNames(isHttps()).google, cookie, cookieOptions(isHttps(), GOOGLE_MAX_AGE))
    response.headers.set('cache-control', 'no-store')
    return response
}
