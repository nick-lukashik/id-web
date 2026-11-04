import { type MetadataRoute } from 'next'
import { locales } from '@/i18n/config'
import { serverEnv } from '@/lib/env/server'
import { languageAlternates, localizedPath } from '@/lib/seo/alternates'

// Per request: SITE_URL is runtime configuration.
export const dynamic = 'force-dynamic'

type Entry = MetadataRoute.Sitemap[number]

/** One entry per language version, each listing all of them as alternates. */
function localized(path: string, extra: Omit<Entry, 'url'> = {}): MetadataRoute.Sitemap {
    const absolute = (url: string) => `${serverEnv.SITE_URL}${url}`
    const languages = Object.fromEntries(
        Object.entries(languageAlternates(path)).map(([lang, url]) => [
            lang,
            absolute(url),
        ]),
    )
    return locales.map(locale => ({
        ...extra,
        url: absolute(localizedPath(path, locale)),
        alternates: {
            languages,
        },
    }))
}

/** The only public page; the rest is behind sign-in. */
export default function sitemap(): MetadataRoute.Sitemap {
    return localized('/login', {
        changeFrequency: 'monthly',
        priority: 1,
    })
}
