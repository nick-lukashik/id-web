import { consentDomain } from '@/lib/analytics/consent'

/**
 * Locale contract. The URL carries no locale: a cookie on the whole domain keeps the choice,
 * `?lang=` overrides it by hand (and rewrites the cookie), and a first visit is in
 * English, whatever the browser's language. src/proxy.ts resolves it once per request.
 */
export const locales = [
    'en',
    'ru',
] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'en'

export const LOCALE_COOKIE = 'nl_locale'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
/** Request header the proxy sets with the resolved locale. */
export const LOCALE_HEADER = 'x-locale'
/** Query parameter that sets the language by hand and rewrites the cookie; the UI switch only sets the cookie. */
export const LOCALE_PARAM = 'lang'

/**
 * Attributes of the locale cookie, the same in the proxy and the switch: one language on
 * every site of the domain. No Domain on localhost or an IP.
 */
export function localeCookieOptions(https: boolean, siteUrl: string) {
    const domain = consentDomain(siteUrl)
    return {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax' as const,
        secure: https,
        ...(domain
            ? {
                  domain,
              }
            : {}),
    }
}

export const ogLocales: Record<AppLocale, string> = {
    en: 'en_US',
    ru: 'ru_RU',
}

export function isLocale(value: unknown): value is AppLocale {
    return typeof value === 'string' && (locales as readonly string[]).includes(value)
}
