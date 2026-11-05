import { type NextRequest, NextResponse } from 'next/server'
import { CONSENT_COOKIE, CONSENT_VALUE, consentCookieOptions } from '@/lib/analytics/consent'
import { serverEnv } from '@/lib/env/server'

/**
 * The banner's "OK". On the server: a cookie set from the page would last seven days in
 * Safari, and the banner would come back every week.
 */
export async function POST(request: NextRequest) {
    if ((request.headers.get('sec-fetch-site') ?? 'same-origin') !== 'same-origin')
        return new NextResponse(null, {
            status: 403,
        })
    const response = new NextResponse(null, {
        status: 204,
    })
    response.cookies.set(CONSENT_COOKIE, CONSENT_VALUE, consentCookieOptions(serverEnv.SITE_URL))
    return response
}
