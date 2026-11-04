import { z } from 'zod'

/**
 * Passkeys, shared by the sign-in page and the account page. The ceremony
 * runs in the browser; everything else goes through server actions to
 * id-api, which keeps the challenges and checks the answers. Browser code
 * imports only types from here (and ceremony.ts).
 */

export type PasskeyItem = {
    id: string
    name: string
    createdAt: string
    lastUsedAt: string | null
    /** Synced by its provider (iCloud Keychain, Google Password Manager). */
    synced: boolean
    usable: boolean
    credentialId: string
}

/** What went wrong, as the messages `passkeys.errors.*` name it. */
export type PasskeyError =
    | 'cancelled'
    | 'not_opened'
    | 'unsupported'
    | 'not_allowed'
    | 'stale'
    | 'rejected'
    | 'unknown'
    | 'exists'
    | 'limit'
    | 'suspended'
    | 'rate_limited'
    | 'unavailable'
    | 'reauth_required'
    | 'failed'

export type Result<T = object> =
    | ({
          ok: true
      } & T)
    | {
          ok: false
          error: PasskeyError
      }

/** A loose shape check before anything is forwarded; id-api checks it all. */
export const ceremonyResponse = z.looseObject({
    id: z.string().min(1).max(1_400),
    rawId: z.string().min(1).max(1_400),
    type: z.literal('public-key'),
    response: z.looseObject({
        clientDataJSON: z.string().max(4_096),
    }),
})

/** An id-api refusal in the words of the pages. */
export function passkeyError(result: { status: number; error?: string }): PasskeyError {
    if (result.error === 'reauthentication_required') return 'reauth_required'
    if (result.error === 'stale') return 'stale'
    if (result.error === 'unknown') return 'unknown'
    if (result.error === 'already_registered') return 'exists'
    if (result.error === 'limit') return 'limit'
    if (result.status === 429) return 'rate_limited'
    if (result.status === 403) return 'suspended'
    if (result.status >= 500) return 'unavailable'
    if (result.status === 422) return 'rejected'
    return 'failed'
}

/** A readable name for a new passkey from the browser it was made in ("Chrome on macOS"). */
export function deviceName(userAgent: string | null): string {
    const ua = userAgent ?? ''
    const os = /iPhone/.test(ua)
        ? 'iPhone'
        : /iPad/.test(ua)
          ? 'iPad'
          : /Android/.test(ua)
            ? 'Android'
            : /Mac OS X|Macintosh/.test(ua)
              ? 'macOS'
              : /Windows/.test(ua)
                ? 'Windows'
                : /CrOS/.test(ua)
                  ? 'ChromeOS'
                  : /Linux/.test(ua)
                    ? 'Linux'
                    : undefined
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : undefined
    if (browser && os) return `${browser} on ${os}`
    return browser ?? os ?? 'Passkey'
}
