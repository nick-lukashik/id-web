'use client'

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { passkeyRegister, passkeyRegisterOptions } from '@/app/actions/passkeys'
import { Button } from '@/components/ui/button'
import { ceremonyError } from '@/lib/passkeys/ceremony'
import { type PasskeyError } from '@/lib/passkeys/passkeys'

/**
 * "Add a passkey" on the account page. id-api accepts it only from a recent
 * sign-in; an older session is asked to sign in again first.
 */
export function AddPasskey() {
    const t = useTranslations('passkeys')
    const router = useRouter()
    const [error, setError] = useState<PasskeyError | null>(null)
    const [added, setAdded] = useState(false)
    const [pending, startTransition] = useTransition()

    const add = () => {
        if (!browserSupportsWebAuthn()) return setError('unsupported')
        setError(null)
        setAdded(false)
        startTransition(async () => {
            const begun = await passkeyRegisterOptions()
            if (!begun.ok) return setError(begun.error)
            let answer: Awaited<ReturnType<typeof startRegistration>>
            try {
                answer = await startRegistration({
                    optionsJSON: begun.options,
                })
            } catch (reason) {
                const key = ceremonyError(reason)
                if (key !== 'aborted') setError(key)
                return
            }
            const saved = await passkeyRegister(begun.challengeId, answer)
            if (!saved.ok) return setError(saved.error)
            setAdded(true)
            router.refresh()
        })
    }

    return (
        <div className="flex flex-col items-start gap-2">
            <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={add}
            >
                {pending ? t('adding') : t('add')}
            </Button>
            <p
                role="status"
                className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            >
                {error === 'reauth_required' ? (
                    <>
                        {t('errors.reauth_required')}{' '}
                        <Link
                            href="/login?reauth=1&continue=%2Faccount"
                            className="underline underline-offset-4"
                        >
                            {t('reauth')}
                        </Link>
                    </>
                ) : error ? (
                    t(`errors.${error}`)
                ) : added ? (
                    t('added')
                ) : null}
            </p>
        </div>
    )
}
