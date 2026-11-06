'use server'

import { cookies, headers } from 'next/headers'
import { serverEnv } from '@/lib/env/server'
import { isLocale, LOCALE_COOKIE, localeCookieOptions } from './config'

/**
 * The language switch: keeps the choice in the locale cookie and nothing in
 * the URL. The caller reloads the page afterwards, because the proxy resolves
 * the locale once per request and this request still carries the old cookie.
 */
export async function setLocale(locale: string): Promise<void> {
    if (!isLocale(locale)) return
    const request = await headers()
    const https = request.get('x-forwarded-proto') === 'https' || (request.get('origin') ?? '').startsWith('https://')
    ;(await cookies()).set(LOCALE_COOKIE, locale, localeCookieOptions(https, serverEnv.SITE_URL))
}
