import { type Route } from 'next'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'
import { endSession, siteReturn } from '@/lib/session/start'

export const dynamic = 'force-dynamic'

/**
 * "Sign out" of the platform's other sites ends here: they end their own
 * session, then send the browser to /logout?return=<their page>. Sign-out
 * ends the session here and every site's session signed in from it (id-api),
 * then the browser goes back. Only a site of the platform (same-site) gets it
 * done by a link; from anywhere else the person confirms with a button first,
 * so another site cannot sign anyone out with a hidden request.
 */
export async function GET(request: NextRequest) {
    const back = siteReturn(request.nextUrl.searchParams.get('return'))
    const from = request.headers.get('sec-fetch-site') ?? 'none'
    if (from === 'cross-site') redirect(`/logout/confirm${back ? `?return=${encodeURIComponent(back)}` : ''}` as Route)
    await endSession()
    redirect((back ?? '/login') as Route)
}

/** The confirmation's button. */
export async function POST(request: NextRequest) {
    // A POST without a form still signs out: there is just nowhere to go back to.
    const form = await request.formData().catch(() => null)
    await endSession()
    redirect((siteReturn(form?.get('return')) ?? '/login') as Route)
}
