/**
 * A path of this site to go to after sign-in (`continue`), or the fallback:
 * only same-origin paths, never `//host` or `/\host`, which browsers read as
 * another site. The base never leaves this function.
 */
export function safeContinue(value: unknown, fallback = '/account'): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
        return fallback
    try {
        const url = new URL(value, 'http://id-web.local')
        if (url.origin !== 'http://id-web.local') return fallback
        return `${url.pathname}${url.search}${url.hash}`
    } catch {
        return fallback
    }
}
