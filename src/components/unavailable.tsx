import { type Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/** A part of a page that did not load, with a link that loads it again. */
export function Unavailable({ message, retry }: { message: string; retry: Route }) {
    const t = useTranslations('states')

    return (
        <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button
                asChild
                variant="outline"
                size="sm"
            >
                <Link
                    href={retry}
                    prefetch={false}
                >
                    {t('retry')}
                </Link>
            </Button>
        </div>
    )
}
