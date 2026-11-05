/**
 * The answer about statistics: a cookie on the whole domain, so a person is
 * asked once across the platform's sites. It opens nothing: anyone on the
 * domain who sets it only changes whether Google Analytics runs.
 */
export const CONSENT_COOKIE = 'nl_consent'

const MAX_AGE = 60 * 60 * 24 * 365

export type ConsentAnswer = 'granted' | 'denied'

export const consentAnswer = (value: string | undefined): ConsentAnswer | undefined =>
    value === 'granted' || value === 'denied' ? value : undefined

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
