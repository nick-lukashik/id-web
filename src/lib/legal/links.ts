import { consentDomain } from '@/lib/analytics/consent'

/** The policy and the terms live on the main site, at this site's registered domain; on localhost or an IP, in prod. */
export function legalLinks(siteUrl: string) {
    const domain = consentDomain(siteUrl) ?? 'nick-lukashik.com'
    return {
        privacy: `https://${domain}/privacy`,
        terms: `https://${domain}/terms`,
    }
}
