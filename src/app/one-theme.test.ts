import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The site has one theme, black and white (Mono Brutal). Components added with
// `shadcn add` bring `dark:` classes, and without a `.dark` variant Tailwind
// applies them when the OS is dark, so a page that changes with the OS
// setting would ship unnoticed.
const DARK = /\bdark:|\.dark\b|light-dark\(|prefers-color-scheme/

const sources = (dir: string): string[] =>
    readdirSync(dir, {
        withFileTypes: true,
    }).flatMap(entry => {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) return sources(file)
        return /\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith('.test.ts')
            ? [
                  file,
              ]
            : []
    })

describe('one theme', () => {
    it('is the only one: no dark variants in src/', () => {
        const offenders = sources('src').filter(file => DARK.test(readFileSync(file, 'utf8')))
        expect(offenders, 'remove the dark: classes / rules from these files').toEqual([])
    })
})
