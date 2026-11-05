import { type AppLocale, defaultLocale, isLocale } from './config'

export type LocaleSource = 'query' | 'cookie' | 'default'

export type ResolvedLocale = {
    locale: AppLocale
    source: LocaleSource
    /** The cookie must be (re)written: `?lang=` picked a different locale. */
    persist: boolean
}

/** Locale for one request: `?lang=` > cookie > English. The browser's language does not decide. */
export function resolveLocale(input: { query?: string | null; cookie?: string | null }): ResolvedLocale {
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
    return {
        locale: defaultLocale,
        source: 'default',
        persist: false,
    }
}
