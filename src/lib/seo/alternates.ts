import { type AppLocale, LOCALE_PARAM, locales } from '@/i18n/config'

/** Request header with the page path, set by src/proxy.ts for metadata. */
export const PATHNAME_HEADER = 'x-pathname'
/** Request header with the canonical path of this request, set by src/proxy.ts. */
export const CANONICAL_HEADER = 'x-canonical-path'

/** Each language version has its own URL: the path plus `?lang=`. */
export function localizedPath(path: string, locale: AppLocale): string {
    return `${path}?${LOCALE_PARAM}=${locale}`
}

/**
 * Every URL of an hreflang cluster is its own canonical: `?lang=xx` points to
 * itself, and the bare path (x-default, negotiated by cookie and
 * Accept-Language) points to the bare path.
 */
export function canonicalPath(path: string, locale: AppLocale, fromQuery: boolean): string {
    return fromQuery ? localizedPath(path, locale) : path
}

/**
 * hreflang alternates: one URL per language, the bare path as x-default
 * (it negotiates by cookie and Accept-Language).
 */
export function languageAlternates(path: string): Record<string, string> {
    return {
        ...Object.fromEntries(
            locales.map(locale => [
                locale,
                localizedPath(path, locale),
            ]),
        ),
        'x-default': path,
    }
}
