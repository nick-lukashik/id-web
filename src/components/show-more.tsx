import { type Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { type List, MAX_SHOWN } from '@/lib/backend/list'
import { Unavailable } from './unavailable'

/**
 * The end of a list: "Show more" (a page more of the same address) while the
 * API has more, why the rest is missing, or nothing.
 */
export function ShowMore({
    list,
    show,
    step,
    href,
}: {
    list: List<unknown>
    show: number
    step: number
    /** The page's address showing that many items. */
    href: (show: number) => Route
}) {
    const t = useTranslations('states')

    if (list.incomplete)
        return (
            <Unavailable
                message={t('moreUnavailable')}
                retry={href(show)}
            />
        )
    if (!list.more) return null
    if (show >= MAX_SHOWN)
        return (
            <p className="text-sm text-muted-foreground">
                {t('capped', {
                    count: show,
                })}
            </p>
        )
    return (
        <Button
            asChild
            variant="outline"
            className="self-start"
        >
            {/* Keeps the scroll position: the new items appear below. */}
            <Link
                href={href(Math.min(show + step, MAX_SHOWN))}
                scroll={false}
                prefetch={false}
            >
                {t('more')}
            </Link>
        </Button>
    )
}
