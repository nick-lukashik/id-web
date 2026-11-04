import 'server-only'
import { backend } from '@/lib/backend/backend'
import { type Session, sessionFromTokens } from './session'

/** Refresh when less than this is left of the access token. */
export const REFRESH_BEFORE_MS = 60_000

/**
 * New tokens for a session. `ended`: id-api refused (revoked, reused,
 * expired), the cookie goes. `unavailable`: keep the cookie and try again on
 * the next request.
 */
export async function refreshSession(session: Session): Promise<Session | 'ended' | 'unavailable'> {
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
    })
    if (result.ok && result.data) return sessionFromTokens(result.data)
    if (result.status === 401 || result.status === 400) return 'ended'
    return 'unavailable'
}
