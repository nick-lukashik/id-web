import { describe, expect, it } from 'vitest'
import { resolveLocale } from './resolve'

describe('resolveLocale', () => {
    it('lets ?lang= win and rewrite a different cookie', () => {
        expect(
            resolveLocale({
                query: 'ru',
                cookie: 'en',
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

    it('is English without a choice', () => {
        expect(resolveLocale({})).toEqual({
            locale: 'en',
            source: 'default',
            persist: false,
        })
        expect(
            resolveLocale({
                cookie: 'xx',
            }).locale,
        ).toBe('en')
    })
})
