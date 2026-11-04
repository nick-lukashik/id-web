/**
 * "This browser is signed in at id-web": a cookie on the parent domain
 * (id.nick-lukashik.com → nick-lukashik.com) that the platform's other sites
 * read to sign a visitor in silently. Not a credential and no data (the value
 * is "1"); it lives as long as the session here. Anyone on the domain could
 * set or drop it: the worst they get is one trip to /authorize, which decides
 * on the session here.
 */
export const HINT_COOKIE = 'nl_hint'

/** The parent domain of this site's host; none for localhost or an IP (cookies there ignore the port anyway). */
export function hintDomain(siteUrl: string): string | undefined {
    const { hostname } = new URL(siteUrl)
    if (hostname.includes(':') || /^[\d.]+$/.test(hostname)) return undefined
    const labels = hostname.split('.')
    return labels.length > 2 ? labels.slice(1).join('.') : undefined
}

export function hintCookieOptions(https: boolean, domain: string | undefined, maxAge: number) {
    return {
        httpOnly: true,
        secure: https,
        sameSite: 'lax' as const,
        path: '/',
        maxAge,
        ...(domain
            ? {
                  domain,
              }
            : {}),
    }
}
