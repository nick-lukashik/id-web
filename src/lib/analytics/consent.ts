/**
 * The banner's "OK": a cookie on the whole domain, so a person sees it once across the
 * platform's sites. It only hides the banner: statistics run either way.
 */
export const CONSENT_COOKIE = 'nl_consent'
export const CONSENT_VALUE = 'true'

const MAX_AGE = 60 * 60 * 24 * 365

export const consentPressed = (value: string | undefined) => value === CONSENT_VALUE

/** The registered domain of this site's host, for a subdomain and the root alike; none for localhost or an IP. */
export function consentDomain(siteUrl: string): string | undefined {
    const { hostname } = new URL(siteUrl)
    if (hostname.includes(':') || /^[\d.]+$/.test(hostname)) return undefined
    const labels = hostname.split('.')
    return labels.length >= 2 ? labels.slice(-2).join('.') : undefined
}

export function consentCookieOptions(siteUrl: string) {
    const domain = consentDomain(siteUrl)
    return {
        httpOnly: true,
        secure: siteUrl.startsWith('https://'),
        sameSite: 'lax' as const,
        path: '/',
        maxAge: MAX_AGE,
        ...(domain
            ? {
                  domain,
              }
            : {}),
    }
}
