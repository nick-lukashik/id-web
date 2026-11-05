import 'server-only'
import { serverEnv } from '@/lib/env/server'

/** A URL on one of the platform's sites (FORM_ACTION_ORIGINS), or undefined. */
export function siteReturn(value: unknown): string | undefined {
    if (typeof value !== 'string' || !URL.canParse(value)) return undefined
    const url = new URL(value)
    return serverEnv.FORM_ACTION_ORIGINS.includes(url.origin) ? url.toString() : undefined
}

/**
 * Where to go after sign-in (`continue`), or the fallback: a page of one of the
 * platform's sites, or a same-origin path, never `//host` or `/\\host`, which
 * browsers read as another site, also when only the URL parser makes it so
 * (`/.//host`). The base never leaves this function.
 */
export function safeContinue(value: unknown, fallback = '/account'): string {
    const site = siteReturn(value)
    if (site) return site
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
        return fallback
    try {
        const url = new URL(value, 'http://id-web.local')
        if (url.origin !== 'http://id-web.local' || url.pathname.startsWith('//')) return fallback
        return `${url.pathname}${url.search}${url.hash}`
    } catch {
        return fallback
    }
}
