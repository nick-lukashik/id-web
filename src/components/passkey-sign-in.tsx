'use client'

import {
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
    startAuthentication,
    WebAuthnAbortService,
} from '@simplewebauthn/browser'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { passkeySignIn, passkeySignInOptions } from '@/app/actions/passkeys'
import { Button } from '@/components/ui/button'
import { ceremonyError } from '@/lib/passkeys/ceremony'
import { type PasskeyError } from '@/lib/passkeys/passkeys'

/** Autofill waits as long as the page is open, a challenge lives five minutes: a fresh one is taken before that. */
const REARM_MS = 4 * 60_000

/**
 * "Sign in with a passkey", and the same passkeys in the email field's
 * autofill where the browser offers it (conditional mediation). No email is
 * asked: the passkey names the account. Signed in, the action redirects and
 * nothing comes back; otherwise the problem does.
 */
export function PasskeySignIn({ continueTo }: { continueTo: string }) {
    const t = useTranslations('passkeys')
    const [error, setError] = useState<PasskeyError | null>(null)
    const [pending, startTransition] = useTransition()
    // Bumped to arm the autofill again: after our own ceremony, and on a timer.
    const [armed, setArmed] = useState(0)
    const modal = useRef(false)

    // biome-ignore lint/correctness/useExhaustiveDependencies: `armed` is the trigger; each value is one autofill request.
    useEffect(() => {
        let active = true
        let timer: ReturnType<typeof setTimeout> | undefined
        const arm = async () => {
            if (!(await browserSupportsWebAuthnAutofill()) || !active) return
            const begun = await passkeySignInOptions()
            // Quietly: the button still works, and says what is wrong.
            if (!begun.ok || !active || modal.current) return
            timer = setTimeout(() => {
                if (!modal.current) setArmed(n => n + 1)
            }, REARM_MS)
            let answer: Awaited<ReturnType<typeof startAuthentication>>
            try {
                answer = await startAuthentication({
                    optionsJSON: begun.options,
                    useBrowserAutofill: true,
                    // The email field comes and goes with the steps of the form.
                    verifyBrowserAutofillInput: false,
                })
            } catch (reason) {
                if (active && ceremonyError(reason) === 'failed') setError('failed')
                return
            } finally {
                clearTimeout(timer)
            }
            setError(null)
            const result = await passkeySignIn(begun.challengeId, answer, continueTo)
            if (!active) return
            if (result && !result.ok) setError(result.error)
            setArmed(n => n + 1)
        }
        void arm()
        return () => {
            active = false
            clearTimeout(timer)
            if (!modal.current) WebAuthnAbortService.cancelCeremony()
        }
    }, [
        armed,
        continueTo,
    ])

    const signIn = () => {
        if (!browserSupportsWebAuthn()) return setError('unsupported')
        setError(null)
        startTransition(async () => {
            modal.current = true
            try {
                const begun = await passkeySignInOptions()
                if (!begun.ok) return setError(begun.error)
                let answer: Awaited<ReturnType<typeof startAuthentication>>
                try {
                    answer = await startAuthentication({
                        optionsJSON: begun.options,
                    })
                } catch (reason) {
                    const key = ceremonyError(reason)
                    if (key !== 'aborted') setError(key)
                    return
                }
                const result = await passkeySignIn(begun.challengeId, answer, continueTo)
                if (result && !result.ok) setError(result.error)
            } finally {
                modal.current = false
                setArmed(n => n + 1)
            }
        })
    }

    return (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={signIn}
            >
                {pending ? t('signingIn') : t('signIn')}
            </Button>
            <p
                role="status"
                className={error ? 'text-sm text-destructive' : 'sr-only'}
            >
                {error ? t(`errors.${error}`) : null}
            </p>
        </div>
    )
}
