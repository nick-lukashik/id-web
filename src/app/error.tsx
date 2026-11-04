'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type ErrorProps = {
    error: unknown
    retry: () => void
}

/** Errors below the root layout: the header and language stay in place. */
export default function ErrorPage({ error, retry }: ErrorProps) {
    const t = useTranslations('error')
    const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : undefined

    return (
        <section
            role="alert"
            className="mx-auto grid max-w-xl gap-4 py-10 text-center"
        >
            <title>{t('title')}</title>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('body')}</p>
            {digest && (
                <p className="font-mono text-sm text-muted-foreground">
                    {t('digest', {
                        digest,
                    })}
                </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => retry()}>{t('retry')}</Button>
                <Button
                    asChild
                    variant="outline"
                >
                    <Link href="/">{t('home')}</Link>
                </Button>
            </div>
        </section>
    )
}
