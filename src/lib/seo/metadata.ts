import 'server-only'
import { headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { defaultLocale, isLocale, locales, ogLocales } from '@/i18n/config'
import { CANONICAL_HEADER, localizedPath } from './alternates'

/**
 * Open Graph fields every page shares. Next.js merges metadata shallowly, so
 * a page that sets its own `openGraph` (e.g. `type: "article"`) spreads
 * these in to keep the site name, locale and URL.
 */
export async function baseOpenGraph(path: string) {
    const [t, current, requestHeaders] = await Promise.all([
        getTranslations('meta'),
        getLocale(),
        headers(),
    ])
    const locale = isLocale(current) ? current : defaultLocale
    return {
        siteName: t('siteName'),
        locale: ogLocales[locale],
        alternateLocale: locales.filter(other => other !== locale).map(other => ogLocales[other]),
        // og:url matches the canonical URL of this request.
        url: requestHeaders.get(CANONICAL_HEADER) ?? localizedPath(path, locale),
    }
}
