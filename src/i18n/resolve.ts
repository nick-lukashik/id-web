import { type AppLocale, defaultLocale, isLocale, locales } from './config'

export type LocaleSource = 'query' | 'cookie' | 'header' | 'default'

export type ResolvedLocale = {
    locale: AppLocale
    source: LocaleSource
    /** The cookie must be (re)written: `?lang=` picked a different locale. */
    persist: boolean
}

/**
 * Picks the best supported locale from an Accept-Language header,
 * honouring q-values and falling back from regions (`ru-RU` → `ru`).
 */
export function negotiateLocale(header: string | null | undefined): AppLocale | undefined {
    if (!header) return undefined
    const ranked = header
        .split(',')
        .map((part, index) => {
            const [tag = '', ...params] = part.trim().split(';')
            const q = params.map(p => p.trim()).find(p => p.startsWith('q='))
            const weight = q ? Number.parseFloat(q.slice(2)) : 1
            return {
                tag: tag.toLowerCase(),
                weight: Number.isNaN(weight) ? 0 : weight,
                index,
            }
        })
        .filter(({ tag, weight }) => tag !== '' && weight > 0)
        .sort((a, b) => b.weight - a.weight || a.index - b.index)
    for (const { tag } of ranked) {
        const base = tag.split('-')[0]
        const match = locales.find(locale => locale === tag || locale === base)
        if (match) return match
    }
    return undefined
}

/** Locale for one request: `?lang=` > cookie > Accept-Language > default. */
export function resolveLocale(input: {
    query?: string | null
    cookie?: string | null
    acceptLanguage?: string | null
}): ResolvedLocale {
    if (isLocale(input.query)) {
        return {
            locale: input.query,
            source: 'query',
            persist: input.query !== input.cookie,
        }
    }
    if (isLocale(input.cookie))
        return {
            locale: input.cookie,
            source: 'cookie',
            persist: false,
        }
    const negotiated = negotiateLocale(input.acceptLanguage)
    if (negotiated)
        return {
            locale: negotiated,
            source: 'header',
            persist: false,
        }
    return {
        locale: defaultLocale,
        source: 'default',
        persist: false,
    }
}
