'use client'

import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { type MouseEvent, useTransition } from 'react'
import { setLocale } from '@/i18n/actions'
import { type AppLocale, LOCALE_PARAM, locales } from '@/i18n/config'
import { localizedPath } from '@/lib/seo/alternates'
import { cn } from '@/lib/utils'

/**
 * Links to the same page with `?lang=`, so the switch works without
 * JavaScript and doubles as hreflang links. With JavaScript a click only
 * rewrites the locale cookie (a Server Action) and reloads the page: the
 * address keeps no `?lang=`, which stays for setting the language by hand.
 */
export function LocaleSwitch({ names }: { names: Record<AppLocale, string> }) {
    const t = useTranslations('nav')
    const current = useLocale()
    const pathname = usePathname()
    const [pending, startTransition] = useTransition()

    function switchTo(event: MouseEvent<HTMLAnchorElement>, locale: AppLocale) {
        // New tab, new window and the like keep the plain link.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        if (locale === current || pending) return
        startTransition(async () => {
            try {
                await setLocale(locale)
            } catch {
                // The Server Action failed: the link does the same through ?lang=.
                window.location.assign(localizedPath(pathname, locale))
                return
            }
            // A full load on purpose: the root layout must re-render in the new
            // language. A ?lang= set by hand would override the cookie, so it goes.
            const url = new URL(window.location.href)
            url.searchParams.delete(LOCALE_PARAM)
            if (url.href === window.location.href) window.location.reload()
            else window.location.replace(url.href)
        })
    }

    return (
        <nav
            aria-label={t('language')}
            className="flex items-center gap-1"
        >
            {locales.map(locale => (
                <a
                    key={locale}
                    href={localizedPath(pathname, locale)}
                    onClick={event => switchTo(event, locale)}
                    hrefLang={locale}
                    lang={locale}
                    aria-current={locale === current ? 'true' : undefined}
                    className={cn(
                        'inline-flex h-9 items-center rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground',
                        'aria-[current]:bg-muted aria-[current]:font-medium aria-[current]:text-foreground',
                    )}
                >
                    <span aria-hidden="true">{locale.toUpperCase()}</span>
                    <span className="sr-only">{names[locale]}</span>
                </a>
            ))}
        </nav>
    )
}
