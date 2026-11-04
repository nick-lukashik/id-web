import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env/server'
import { safeContinue } from '@/lib/session/continue'
import { seal, unseal } from '@/lib/session/seal'

/**
 * Sign-in with Google, browser side: authorization code with PKCE and a
 * nonce. The pending request waits in a sealed cookie for 10 minutes; the
 * code itself is exchanged by id-api, which holds the client secret. A link
 * also keeps who started it, so the callback links only for that same user
 * and session.
 */
export const GOOGLE_MAX_AGE = 600

export type GoogleIntent = 'login' | 'link'
/** The user and the session that started a link. */
export type GoogleOwner = {
    userId: string
    sessionId: string
}
export type GoogleConfig = {
    enabled: boolean
    /** Google's authorization endpoint, as id-api names it (a stand-in in e2e). */
    authorizationEndpoint: string | null
    clientId: string | null
    redirectUri: string | null
}
type Pending = {
    state: string
    nonce: string
    verifier: string
    continueTo: string
    intent: GoogleIntent
    owner?: GoogleOwner
}

export function startGoogle(
    config: {
        authorizationEndpoint: string
        clientId: string
        redirectUri: string
    },
    intent: GoogleIntent,
    continueTo: string,
    owner?: GoogleOwner,
) {
    const pending: Pending = {
        state: randomBytes(24).toString('base64url'),
        nonce: randomBytes(24).toString('base64url'),
        verifier: randomBytes(48).toString('base64url'),
        continueTo,
        intent,
        owner,
    }
    const url = new URL(config.authorizationEndpoint)
    url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state: pending.state,
        nonce: pending.nonce,
        code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
        code_challenge_method: 'S256',
        prompt: 'select_account',
    }).toString()
    return {
        url: url.toString(),
        cookie: seal(pending, serverEnv.SESSION_SECRET, 'google'),
    }
}

export function readPending(value: string | undefined): Pending | undefined {
    const pending = unseal<Pending>(value, serverEnv.SESSION_SECRET, 'google')
    if (!pending) return undefined
    return {
        ...pending,
        intent: pending.intent === 'link' ? 'link' : 'login',
        continueTo: safeContinue(pending.continueTo),
    }
}

export function sameState(given: string | null, expected: string) {
    if (!given) return false
    const a = Buffer.from(given)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
}

/** Whether the callback runs in the session that started the link (no owner: never). */
export function sameOwner(started: GoogleOwner | undefined, current: GoogleOwner) {
    return started?.userId === current.userId && started.sessionId === current.sessionId
}

/** Messages `account.googleErrors.*` know these, `login.errors.*` those of a sign-in. */
export type GoogleError =
    | 'google_failed'
    | 'google_cancelled'
    | 'google_unavailable'
    | 'google_link_required'
    | 'google_unverified'
    | 'google_in_use'
    | 'google_already_linked'
    | 'google_suspended'
    | 'google_reauth_required'
    | 'google_session_changed'

/** An id-api refusal in the words of the pages. */
export function googleError(result: { status: number; error?: string }): GoogleError {
    if (result.error === 'link_required') return 'google_link_required'
    if (result.error === 'unverified') return 'google_unverified'
    if (result.error === 'in_use') return 'google_in_use'
    if (result.error === 'already_linked') return 'google_already_linked'
    if (result.error === 'reauthentication_required') return 'google_reauth_required'
    if (result.status === 403) return 'google_suspended'
    if (result.status === 404 || result.status >= 500) return 'google_unavailable'
    return 'google_failed'
}
