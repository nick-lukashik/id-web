import { type Route } from 'next'
import { redirect } from 'next/navigation'
import { type NextRequest, NextResponse } from 'next/server'
import { siteReturn } from '@/lib/session/continue'
import { endSession, SIGN_OUT_FAILED } from '@/lib/session/start'

export const dynamic = 'force-dynamic'

/**
 * "Sign out" of a site on another domain ends here: it ends its own session,
 * then sends the browser to /logout?return=<its page>. Sign-out ends the session
 * here and any site's session signed in from it (id-api), then the browser goes
 * back. Only a same-site page gets it done by a link; from anywhere else the
 * person confirms with a button first, so another site cannot sign anyone out
 * with a hidden request.
 */
export async function GET(request: NextRequest) {
    const back = siteReturn(request.nextUrl.searchParams.get('return'))
    const from = request.headers.get('sec-fetch-site') ?? 'none'
    if (from === 'cross-site') redirect(`/logout/confirm${back ? `?return=${encodeURIComponent(back)}` : ''}` as Route)
    if (!(await endSession())) redirect(SIGN_OUT_FAILED)
    redirect((back ?? '/login') as Route)
}

/**
 * The confirmation's button and the header's form, both of this site. A form on
 * another site gets no session cookie here (SameSite=Lax), but its answer could
 * still expire the cookie, and with it every site's sign-in.
 */
export async function POST(request: NextRequest) {
    if ((request.headers.get('sec-fetch-site') ?? 'same-origin') !== 'same-origin')
        return new NextResponse(null, {
            status: 403,
        })
    if (!(await endSession())) redirect(SIGN_OUT_FAILED)
    redirect((siteReturn(request.nextUrl.searchParams.get('return')) ?? '/login') as Route)
}
