'use client'

import {
    browserSupportsWebAuthn,
    browserSupportsWebAuthnAutofill,
    startAuthentication,
    WebAuthnAbortService,
} from '@simplewebauthn/browser'
import { unstable_rethrow } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { passkeySignIn, passkeySignInOptions, reportPasskeyRefusal } from '@/app/actions/passkeys'
import { Button } from '@/components/ui/button'
import { buttonRefusal, ceremonyError, refusalName } from '@/lib/passkeys/ceremony'
import { type PasskeyError } from '@/lib/passkeys/passkeys'

type Prepared = Extract<
    Awaited<ReturnType<typeof passkeySignInOptions>>,
    {
        ok: true
    }
>

/** Autofill waits as long as the page is open, a challenge lives five minutes: a fresh one is taken before that. */
const REARM_MS = 4 * 60_000
/** How long a challenge taken ahead of the press is used: the rest of its five minutes is the ceremony's. */
const PREPARED_MS = 4.5 * 60_000
/** After a press, or a request that came to nothing, the autofill stays off this long so that the next press finds the way clear. */
const AUTOFILL_HOLD_MS = 15_000
/** A request for a challenge failed (offline after sleep, id-api down, the limit of 60 in 10 minutes): tried again this often. */
const OPTIONS_RETRY_MS = 30_000

/**
 * The browser's answer to the server. An answer that never got there is told
 * like any other failure. A redirect comes back as a rejection too: that is a
 * sign-in that worked, and it goes on.
 */
async function sendAnswer(...args: Parameters<typeof passkeySignIn>): ReturnType<typeof passkeySignIn> {
    try {
        return await passkeySignIn(...args)
    } catch (reason) {
        unstable_rethrow(reason)
        return {
            ok: false,
            error: 'unavailable',
        }
    }
}

/**
 * "Sign in with a passkey", and the same passkeys in the email field's
 * autofill where the browser offers it (conditional mediation). No email is
 * asked: the passkey names the account. Signed in, the action redirects and
 * nothing comes back; otherwise the problem does.
 *
 * Safari wants the button's request made inside the click, with nothing awaited
 * first, and refuses one while the autofill's still waits. So the challenge is
 * fetched before the press, and the autofill's request goes as the press starts.
 *
 * `remembered` is the name of the passkey last used in this browser: the press
 * still asks for any passkey of this site, the browser shows which it holds.
 */
export function PasskeySignIn({ continueTo, remembered }: { continueTo: string; remembered?: string }) {
    const t = useTranslations('passkeys')
    const [error, setError] = useState<PasskeyError | null>(null)
    const [pending, startTransition] = useTransition()
    // Bumped to arm the autofill again: after our own ceremony, and on a timer.
    const [armed, setArmed] = useState(0)
    const modal = useRef(false)
    const prepared = useRef<
        | (Prepared & {
              until: number
          })
        | null
    >(null)
    const autofillHeldUntil = useRef(0)
    const rearm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const rearmIn = (ms: number) => {
        clearTimeout(rearm.current)
        rearm.current = setTimeout(() => {
            if (!modal.current) setArmed(n => n + 1)
        }, ms)
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: `armed` is the trigger; each value is one autofill request.
    useEffect(() => {
        let active = true
        const arm = async () => {
            if (!browserSupportsWebAuthn()) return
            const begun = await passkeySignInOptions().catch(() => null)
            if (!active || modal.current) return
            // Quietly: the button still works, and says what is wrong.
            if (!begun?.ok) return rearmIn(OPTIONS_RETRY_MS)
            prepared.current = {
                ...begun,
                until: Date.now() + PREPARED_MS,
            }
            const held = autofillHeldUntil.current - Date.now()
            rearmIn(held > 0 ? held : REARM_MS)
            if (held > 0 || !(await browserSupportsWebAuthnAutofill()) || !active) return
            // A press may have started during that await.
            if (modal.current || autofillHeldUntil.current > Date.now()) return
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
            }
            clearTimeout(rearm.current)
            prepared.current = null
            setError(null)
            const result = await sendAnswer(begun.challengeId, answer, continueTo)
            if (!active) return
            if (result && !result.ok) setError(result.error)
            setArmed(n => n + 1)
        }
        void arm()
        return () => {
            active = false
            clearTimeout(rearm.current)
            if (!modal.current) WebAuthnAbortService.cancelCeremony()
        }
    }, [
        armed,
        continueTo,
    ])

    // A tab that slept has a challenge past its time, and its timers may not have fired.
    useEffect(() => {
        const wake = () => {
            if (document.visibilityState !== 'visible' || modal.current) return
            if (!prepared.current || prepared.current.until <= Date.now()) setArmed(n => n + 1)
        }
        const restored = (event: PageTransitionEvent) => {
            if (event.persisted) wake()
        }
        document.addEventListener('visibilitychange', wake)
        window.addEventListener('pageshow', restored)
        return () => {
            document.removeEventListener('visibilitychange', wake)
            window.removeEventListener('pageshow', restored)
        }
    }, [])

    /** The press starts: the autofill's request goes now, so that it is gone by the click. */
    const release = () => {
        if (modal.current) return
        autofillHeldUntil.current = Date.now() + AUTOFILL_HOLD_MS
        WebAuthnAbortService.cancelCeremony()
        rearmIn(AUTOFILL_HOLD_MS)
    }

    const signIn = () => {
        if (!browserSupportsWebAuthn()) return setError('unsupported')
        setError(null)
        modal.current = true
        clearTimeout(rearm.current)
        const ready = prepared.current && prepared.current.until > Date.now() ? prepared.current : null
        let started = Date.now()
        // Here, in the click itself: nothing is awaited before the browser is asked.
        const asked = ready
            ? startAuthentication({
                  optionsJSON: ready.options,
              })
            : null
        startTransition(async () => {
            try {
                // Nothing ready (the page's request failed): a browser that insists on the click refuses, and says so below.
                const begun: Awaited<ReturnType<typeof passkeySignInOptions>> =
                    ready
                    ?? (await passkeySignInOptions().catch(() => ({
                        ok: false as const,
                        error: 'unavailable' as const,
                    })))
                if (!begun.ok) return setError(begun.error)
                if (!asked) started = Date.now()
                let answer: Awaited<ReturnType<typeof startAuthentication>>
                try {
                    answer = await (asked
                        ?? startAuthentication({
                            optionsJSON: begun.options,
                        }))
                } catch (reason) {
                    const elapsedMs = Date.now() - started
                    const told = buttonRefusal(reason, elapsedMs)
                    setError(told)
                    // A person cancelling is no news; anything else is what the log is for.
                    if (told !== 'cancelled') void reportPasskeyRefusal(refusalName(reason), elapsedMs).catch(() => {})
                    return
                }
                prepared.current = null
                const result = await sendAnswer(begun.challengeId, answer, continueTo)
                if (result && !result.ok) setError(result.error)
            } finally {
                autofillHeldUntil.current = Date.now() + AUTOFILL_HOLD_MS
                modal.current = false
                setArmed(n => n + 1)
            }
        })
    }

    return (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant={remembered ? 'default' : 'outline'}
                size="lg"
                disabled={pending}
                onPointerDown={release}
                onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    // A key held down is one press, not a request per repeat.
                    if (event.repeat) event.preventDefault()
                    else release()
                }}
                onClick={signIn}
            >
                {pending
                    ? t('signingIn')
                    : remembered
                      ? t('signInWith', {
                            name: remembered,
                        })
                      : t('signIn')}
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
