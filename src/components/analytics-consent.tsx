'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { saveConsent } from '@/app/actions/consent'
import { Button } from '@/components/ui/button'
import { type ConsentAnswer } from '@/lib/analytics/consent'
import { startTagManager, stopTagManager } from '@/lib/analytics/tag-manager'

const ASK_AGAIN = 'nl-consent-ask'

type AnalyticsConsentProps = {
    /** GTM_ID. */
    id: string
    answer?: ConsentAnswer
    privacyUrl?: string
}

/**
 * Statistics only if the person agrees: the banner until they answer, Google
 * Tag Manager only after a yes. The two buttons weigh the same, and the footer's
 * button brings the banner back.
 */
export function AnalyticsConsent({ id, answer, privacyUrl }: AnalyticsConsentProps) {
    const t = useTranslations('consent')
    const [asking, setAsking] = useState(!answer)

    useEffect(() => {
        if (answer === 'granted') startTagManager(id)
    }, [
        id,
        answer,
    ])

    useEffect(() => {
        const ask = () => setAsking(true)
        window.addEventListener(ASK_AGAIN, ask)
        return () => window.removeEventListener(ASK_AGAIN, ask)
    }, [])

    const choose = (granted: boolean) => {
        setAsking(false)
        if (granted) startTagManager(id)
        else stopTagManager()
        // Not saved (offline): the next page asks again.
        void saveConsent(granted).catch(() => {})
    }

    if (!asking) return null
    return (
        <section
            aria-label={t('label')}
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background shadow-lg"
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
                <p className="max-w-2xl text-sm">
                    {t('text')}
                    {privacyUrl ? (
                        <>
                            {' '}
                            <a
                                className="underline underline-offset-4"
                                href={privacyUrl}
                            >
                                {t('more')}
                            </a>
                        </>
                    ) : null}
                </p>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => choose(false)}
                    >
                        {t('decline')}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => choose(true)}
                    >
                        {t('accept')}
                    </Button>
                </div>
            </div>
        </section>
    )
}

/** The footer's way back to the banner. */
export function AnalyticsSettings() {
    const t = useTranslations('consent')
    return (
        <button
            type="button"
            className="underline-offset-4 hover:underline"
            onClick={() => window.dispatchEvent(new Event(ASK_AGAIN))}
        >
            {t('settings')}
        </button>
    )
}
