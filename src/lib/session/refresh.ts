import 'server-only'
import { backend } from '@/lib/backend/backend'
import { type Session, sessionFromTokens } from './session'

/** Refresh when less than this is left of the access token. */
export const REFRESH_BEFORE_MS = 60_000

/**
 * New tokens for a session. `ended`: id-api refused (revoked, reused,
 * expired), the cookie goes. `unavailable`: keep the cookie and try again on
 * the next request. `requestId` is the proxy's: its own request has none yet.
 */
export async function refreshSession(session: Session, requestId?: string): Promise<Session | 'ended' | 'unavailable'> {
    const result = await backend<{
        accessToken: string
        accessExpiresAt: string
        refreshToken: string
        sessionId: string
    }>('id', '/api/v1/sessions/refresh', {
        method: 'POST',
        body: {
            refreshToken: session.refreshToken,
        },
        requestId,
    })
    if (result.ok && result.data) return sessionFromTokens(result.data)
    if (result.status === 401 || result.status === 400) return 'ended'
    return 'unavailable'
}

/** A check that holds up a page: past this the page goes on by its token. */
const ACTIVE_TIMEOUT_MS = 1_000

/**
 * Whether the session of an access token is still alive. False only when id-api
 * says so; if it cannot answer, the page goes on by its token, as it does in an
 * outage.
 */
export async function sessionActive(accessToken: string) {
    const result = await backend<{
        active: boolean
    }>('id', '/api/v1/me/session', {
        token: accessToken,
        timeoutMs: ACTIVE_TIMEOUT_MS,
    })
    return result.data?.active !== false
}
