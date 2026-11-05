'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { startTagManager } from '@/lib/analytics/tag-manager'

type AnalyticsConsentProps = {
    /** GTM_ID. */
    id: string
    /** "OK" was pressed before: no banner. */
    pressed: boolean
    privacyUrl?: string
}

/**
 * Statistics on every visit, through Google Tag Manager. The banner says so until the
 * person presses "OK", which only stores that they did (POST /consent).
 */
export function AnalyticsConsent({ id, pressed, privacyUrl }: AnalyticsConsentProps) {
    const t = useTranslations('consent')
    const [showing, setShowing] = useState(!pressed)

    useEffect(() => {
        startTagManager(id)
    }, [
        id,
    ])

    const ok = () => {
        setShowing(false)
        // Not saved (offline): the next page shows it again.
        void fetch('/consent', {
            method: 'POST',
        }).catch(() => {})
    }

    if (!showing) return null
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
                <Button
                    type="button"
                    variant="outline"
                    onClick={ok}
                >
                    {t('ok')}
                </Button>
            </div>
        </section>
    )
}
