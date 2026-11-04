import { describe, expect, it } from 'vitest'
import { negotiateLocale, resolveLocale } from './resolve'

describe('resolveLocale', () => {
    it('lets ?lang= win and rewrite a different cookie', () => {
        expect(
            resolveLocale({
                query: 'ru',
                cookie: 'en',
                acceptLanguage: 'en',
            }),
        ).toEqual({
            locale: 'ru',
            source: 'query',
            persist: true,
        })
    })

    it('does not rewrite the cookie when ?lang= repeats it', () => {
        expect(
            resolveLocale({
                query: 'ru',
                cookie: 'ru',
            }).persist,
        ).toBe(false)
    })

    it('ignores an unsupported ?lang=', () => {
        expect(
            resolveLocale({
                query: 'de',
                cookie: 'ru',
            }),
        ).toMatchObject({
            locale: 'ru',
            source: 'cookie',
        })
    })

    it('prefers the cookie over Accept-Language', () => {
        expect(
            resolveLocale({
                cookie: 'en',
                acceptLanguage: 'ru-RU,ru;q=0.9',
            }).locale,
        ).toBe('en')
    })

    it('falls back to Accept-Language, then to English', () => {
        expect(
            resolveLocale({
                acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.8',
            }),
        ).toMatchObject({
            locale: 'ru',
            source: 'header',
        })
        expect(
            resolveLocale({
                cookie: 'xx',
                acceptLanguage: 'de-DE',
            }),
        ).toEqual({
            locale: 'en',
            source: 'default',
            persist: false,
        })
    })
})

describe('negotiateLocale', () => {
    it('honours q-values over order', () => {
        expect(negotiateLocale('en;q=0.5, ru;q=0.9')).toBe('ru')
    })

    it('keeps header order for equal weights and skips q=0', () => {
        expect(negotiateLocale('ru, en')).toBe('ru')
        expect(negotiateLocale('ru;q=0, en')).toBe('en')
    })

    it('matches regional tags to their language', () => {
        expect(negotiateLocale('en-GB')).toBe('en')
    })

    it('returns undefined for nothing usable', () => {
        expect(negotiateLocale(null)).toBeUndefined()
        expect(negotiateLocale('*')).toBeUndefined()
        expect(negotiateLocale('fr-FR,de;q=0.8')).toBeUndefined()
    })
})
