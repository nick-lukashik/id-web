import { describe, expect, it } from 'vitest'
import { languageAlternates, localizedPath } from './alternates'
import { buildRobots } from './robots'

describe('buildRobots', () => {
    it('allows crawling and points at the sitemap', () => {
        expect(buildRobots('index', 'https://example.com')).toEqual({
            rules: {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/health/',
                    '/account',
                    '/wallet',
                    '/payments',
                    '/notifications',
                    '/authorize',
                ],
            },
            sitemap: 'https://example.com/sitemap.xml',
        })
    })

    it('disallows everything on noindex environments', () => {
        expect(buildRobots('noindex', 'https://stage.example.com')).toEqual({
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        })
    })
})

describe('languageAlternates', () => {
    it('lists every language and the negotiating x-default', () => {
        expect(languageAlternates('/login')).toEqual({
            en: '/login?lang=en',
            ru: '/login?lang=ru',
            'x-default': '/login',
        })
        expect(localizedPath('/', 'ru')).toBe('/?lang=ru')
    })
})
