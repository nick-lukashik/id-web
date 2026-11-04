'use client'

import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { type AppLocale, defaultLocale, isLocale, LOCALE_COOKIE } from '@/i18n/config'
import en from '@/i18n/messages/en.json'
import ru from '@/i18n/messages/ru.json'
import { negotiateLocale } from '@/i18n/resolve'
import './globals.css'

const messages: Record<AppLocale, typeof en.error> = {
    en: en.error,
    ru: ru.error,
}

// The root layout failed, so there is no next-intl provider: read the locale
// the same way the proxy does, from the cookie or the browser's languages.
function browserLocale(): AppLocale {
    const cookie = document.cookie
        .split('; ')
        .find(part => part.startsWith(`${LOCALE_COOKIE}=`))
        ?.split('=')[1]
    if (isLocale(cookie)) return cookie
    return negotiateLocale(navigator.languages.join(',')) ?? defaultLocale
}
const subscribe = () => () => {}

/** Replaces the root layout when it fails; renders its own document. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
    const locale = useSyncExternalStore(subscribe, browserLocale, () => defaultLocale)
    const t = messages[locale]
    return (
        <html lang={locale}>
            <body className="grid min-h-dvh place-items-center p-6">
                <title>{t.title}</title>
                <main className="grid max-w-xl gap-4 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                    <p className="text-muted-foreground">{t.body}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={() => retry()}>{t.retry}</Button>
                        {/* A full reload: the client router may be the broken part. */}
                        <Button
                            asChild
                            variant="outline"
                        >
                            <a href="/">{t.home}</a>
                        </Button>
                    </div>
                </main>
            </body>
        </html>
    )
}
