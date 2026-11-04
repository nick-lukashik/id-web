import { type MetadataRoute } from 'next'

/** Never crawled: probes and the pages behind sign-in (only /login is public). */
const PRIVATE_PATHS = [
    '/health/',
    '/account',
    '/wallet',
    '/payments',
    '/notifications',
]

/** `robots` of a page behind sign-in, for the case a crawler gets one anyway. */
export const PRIVATE_PAGE = {
    index: false,
    follow: false,
} as const

export function buildRobots(mode: 'index' | 'noindex', siteUrl: string): MetadataRoute.Robots {
    if (mode === 'noindex') {
        return {
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        }
    }
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: PRIVATE_PATHS,
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    }
}
