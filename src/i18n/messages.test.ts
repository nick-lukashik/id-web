import { describe, expect, it } from 'vitest'
import en from './messages/en.json'
import ru from './messages/ru.json'

const keys = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
        : [
              prefix.slice(0, -1),
          ]

describe('messages', () => {
    it('have the same keys in every language', () => {
        expect(keys(ru).sort()).toEqual(keys(en).sort())
    })

    it('have no empty strings', () => {
        for (const catalog of [
            en,
            ru,
        ]) {
            const values = JSON.stringify(catalog)
            expect(values).not.toContain('""')
        }
    })
})
