import { WebAuthnError } from '@simplewebauthn/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buttonRefusal, refusalName } from './ceremony'

const refused = (name: string) => new DOMException('refused', name)
const passedThrough = (name: string) =>
    new WebAuthnError({
        message: 'refused',
        code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
        cause: refused(name),
    })

beforeEach(() => {
    // browserSupportsWebAuthn() looks for it.
    vi.stubGlobal('PublicKeyCredential', () => {})
})

describe('buttonRefusal', () => {
    it('a refusal at once is a window that did not open', () => {
        expect(buttonRefusal(refused('NotAllowedError'), 20)).toBe('not_opened')
        expect(buttonRefusal(passedThrough('NotAllowedError'), 20)).toBe('not_opened')
    })

    it('a refusal later is a person who cancelled', () => {
        expect(buttonRefusal(refused('NotAllowedError'), 4_000)).toBe('cancelled')
        expect(buttonRefusal(passedThrough('NotAllowedError'), 4_000)).toBe('cancelled')
    })

    it('an abort of the button is never silent, however late', () => {
        expect(buttonRefusal(refused('AbortError'), 20)).toBe('not_opened')
        expect(
            buttonRefusal(
                new WebAuthnError({
                    message: 'aborted',
                    code: 'ERROR_CEREMONY_ABORTED',
                    cause: refused('AbortError'),
                }),
                4_000,
            ),
        ).toBe('not_opened')
    })

    it('other failures keep their own message', () => {
        expect(buttonRefusal(refused('SecurityError'), 20)).toBe('not_allowed')
    })
})

describe('refusalName', () => {
    it('reads the name of the cause, or of the error', () => {
        expect(refusalName(passedThrough('NotAllowedError'))).toBe('NotAllowedError')
        expect(refusalName(refused('AbortError'))).toBe('AbortError')
    })

    it('anything it does not know is `other`', () => {
        expect(refusalName(new TypeError('nope'))).toBe('other')
        expect(refusalName(refused('Made up by a page'))).toBe('other')
        expect(refusalName('a string')).toBe('other')
    })
})
