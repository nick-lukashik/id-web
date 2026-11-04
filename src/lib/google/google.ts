import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/lib/env/server'
import { safeContinue } from '@/lib/session/continue'
import { seal, unseal } from '@/lib/session/seal'

/**
 * Sign-in with Google, browser side: authorization code with PKCE and a
 * nonce. The pending request waits in a sealed cookie for 10 minutes; the
 * code itself is exchanged by id-api, which holds the client secret.
 */
export const GOOGLE_MAX_AGE = 600

export type GoogleIntent = 'login' | 'link'
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
}

export function startGoogle(
    config: {
        authorizationEndpoint: string
        clientId: string
        redirectUri: string
    },
    intent: GoogleIntent,
    continueTo: string,
) {
    const pending: Pending = {
        state: randomBytes(24).toString('base64url'),
        nonce: randomBytes(24).toString('base64url'),
        verifier: randomBytes(48).toString('base64url'),
        continueTo,
        intent,
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

/** Messages `login.errors.*` and `account.methods.errors.*` know these. */
export type GoogleError =
    | 'google_failed'
    | 'google_cancelled'
    | 'google_unavailable'
    | 'google_link_required'
    | 'google_unverified'
    | 'google_in_use'
    | 'google_already_linked'
    | 'google_suspended'

/** An id-api refusal in the words of the pages. */
export function googleError(result: { status: number; error?: string }): GoogleError {
    if (result.error === 'link_required') return 'google_link_required'
    if (result.error === 'unverified') return 'google_unverified'
    if (result.error === 'in_use') return 'google_in_use'
    if (result.error === 'already_linked') return 'google_already_linked'
    if (result.status === 403) return 'google_suspended'
    if (result.status === 404 || result.status >= 500) return 'google_unavailable'
    return 'google_failed'
}
