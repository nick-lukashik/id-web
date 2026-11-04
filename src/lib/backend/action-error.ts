import { type Route } from 'next'
import { redirect } from 'next/navigation'
import { currentSession } from '@/lib/session/current'

/** Why an action did not work, as the messages `actionErrors.*` name it. */
const ACTION_ERRORS = [
    'forbidden',
    'not_found',
    'rate_limited',
    'unavailable',
    'failed',
] as const
export type ActionError = (typeof ACTION_ERRORS)[number]

/** An API refusal in the words of the pages (a 401 never gets here, see `refused`). */
export function actionError(status: number): ActionError {
    if (status === 403) return 'forbidden'
    if (status === 404) return 'not_found'
    if (status === 429) return 'rate_limited'
    if (status >= 500) return 'unavailable'
    return 'failed'
}

/** `?error=` of a page, if it is one of these. */
export function actionErrorParam(value: unknown): ActionError | undefined {
    return ACTION_ERRORS.find(reason => reason === value)
}

/** Back to the page the action came from, with why it did not work. */
export function backWithError(back: string, reason: ActionError): never {
    const url = new URL(back, 'http://id-web.local')
    url.searchParams.set('error', reason)
    redirect(`${url.pathname}${url.search}` as Route)
}

/** The session is over: sign in again (as /authorize does) and come back. */
function signInAgain(back: string): never {
    redirect(`/login?reauth=1&continue=${encodeURIComponent(back)}` as Route)
}

/**
 * The calls of a page behind sign-in: a 401 on any of them ends it; the page says
 * what else went wrong. Not when the access token has simply run out: the proxy
 * would have refreshed it unless id-api is down, and then the session may be fine
 * and a sign-in could not work anyway, so the page says "unavailable".
 */
export async function signInAgainOn401(
    back: string,
    ...calls: {
        status: number
    }[]
) {
    if (!calls.some(call => call.status === 401)) return
    const session = await currentSession()
    if (session && session.accessExpiresAt <= Date.now()) return
    signInAgain(back)
}

/**
 * The end of an action the API refused. A 401 means the session is over;
 * anything else goes back with the reason.
 */
export function refused(
    result: {
        status: number
    },
    back: string,
): never {
    if (result.status === 401) signInAgain(back)
    backWithError(back, actionError(result.status))
}
