import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale, LOCALE_COOKIE, LOCALE_HEADER } from './config'

/**
 * next-intl config for the current request. The proxy has already resolved
 * the locale (?lang= > cookie > Accept-Language); the cookie fallback covers
 * requests the proxy does not match.
 */
export default getRequestConfig(async ({ locale: override }) => {
    const resolved = (await headers()).get(LOCALE_HEADER)
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value
    const locale = isLocale(override)
        ? override
        : isLocale(resolved)
          ? resolved
          : isLocale(cookie)
            ? cookie
            : defaultLocale
    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default,
        // Same output on the server and in the browser; dates show their zone.
        timeZone: 'UTC',
    }
})
