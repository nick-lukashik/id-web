import { describe, expect, it } from 'vitest'
import { deviceName, passkeyError } from './passkeys'

describe('deviceName', () => {
    it('names the browser and the system', () => {
        expect(
            deviceName(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            ),
        ).toBe('Chrome on macOS')
        expect(
            deviceName(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
            ),
        ).toBe('Safari on iPhone')
        expect(deviceName(null)).toBe('Passkey')
    })
})

describe('passkeyError', () => {
    it('reads the refusals of id-api', () => {
        expect(
            passkeyError({
                status: 403,
                error: 'reauthentication_required',
            }),
        ).toBe('reauth_required')
        expect(
            passkeyError({
                status: 422,
                error: 'unknown',
            }),
        ).toBe('unknown')
        expect(
            passkeyError({
                status: 503,
                error: 'unavailable',
            }),
        ).toBe('unavailable')
    })
})
