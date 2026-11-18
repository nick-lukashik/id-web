'use client'

import { Button } from '@nick-lukashik/ui/button'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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
            className="fixed bottom-3 left-3 z-40 max-w-[300px] border border-line bg-background p-3 sm:bottom-4 sm:left-4"
        >
            <div className="flex items-end gap-3">
                <p className="text-[0.6875rem] leading-snug text-muted-foreground">
                    {t('text')}
                    {privacyUrl ? (
                        <>
                            {' '}
                            <a
                                className="underline underline-offset-2 hover:text-foreground"
                                href={privacyUrl}
                            >
                                {t('more')}
                            </a>
                        </>
                    ) : null}
                </p>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 px-3"
                    onClick={ok}
                >
                    {t('ok')}
                </Button>
            </div>
        </section>
    )
}
