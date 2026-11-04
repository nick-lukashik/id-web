import { browserSupportsWebAuthn, WebAuthnError } from '@simplewebauthn/browser'
import { type PasskeyError } from './passkeys'

/**
 * Why the browser's side of a ceremony failed. Browsers use one
 * NotAllowedError for "cancelled", "timed out" and "no passkey here" on
 * purpose (it hides which passkeys exist), so they read as one message.
 * `aborted` is our own doing (a newer ceremony replaced this one): silent.
 */
export function ceremonyError(error: unknown): PasskeyError | 'aborted' {
    if (!browserSupportsWebAuthn()) return 'unsupported'
    if (error instanceof WebAuthnError) {
        switch (error.code) {
            case 'ERROR_CEREMONY_ABORTED':
                return 'aborted'
            case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
                return 'exists'
            case 'ERROR_INVALID_DOMAIN':
            case 'ERROR_INVALID_RP_ID':
                return 'not_allowed'
            case 'ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT':
            case 'ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT':
            case 'ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG':
            case 'ERROR_MALFORMED_PUBKEYCREDPARAMS':
                return 'unsupported'
            case 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY':
                return nameOf(error.cause) === 'NotAllowedError' ? 'cancelled' : 'failed'
            default:
                return 'failed'
        }
    }
    switch (nameOf(error)) {
        case 'AbortError':
            return 'aborted'
        case 'NotAllowedError':
            return 'cancelled'
        // Blocked by Permissions-Policy, an insecure context or a foreign frame.
        case 'SecurityError':
            return 'not_allowed'
        case 'NotSupportedError':
            return 'unsupported'
        default:
            return 'failed'
    }
}

/** Nobody can cancel a passkey window that fast: the browser refused without showing one. */
const REFUSED_AT_ONCE_MS = 500

/**
 * What the person is told when the button's request fails. Nothing replaces
 * that request, so unlike the autofill's an abort is not our doing, and it must
 * not be silent: the person pressed a button and nothing happened.
 */
export function buttonRefusal(error: unknown, elapsedMs: number): PasskeyError {
    const key = ceremonyError(error)
    if (key === 'aborted' || (key === 'cancelled' && elapsedMs < REFUSED_AT_ONCE_MS)) return 'not_opened'
    return key
}

/** The names a refusal may go to the log under: only these, nothing the browser or a page made up. */
export const REFUSAL_NAMES = [
    'NotAllowedError',
    'AbortError',
    'SecurityError',
    'NotSupportedError',
    'InvalidStateError',
    'ConstraintError',
    'UnknownError',
    'other',
] as const

export type RefusalName = (typeof REFUSAL_NAMES)[number]

export function refusalName(error: unknown): RefusalName {
    const cause = error instanceof WebAuthnError ? error.cause : error
    const name = nameOf(cause) ?? nameOf(error)
    return REFUSAL_NAMES.find(known => known === name) ?? 'other'
}

const nameOf = (error: unknown) => (error instanceof Error ? error.name : undefined)
