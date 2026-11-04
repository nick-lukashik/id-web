// Creates .env.local from .env.example, or adds variables that appeared in
// .env.example since, keeping the values already set.
//   pnpm env:local            # create or update
//   pnpm env:local --force    # overwrite from .env.example
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const example = '.env.example'
const target = '.env.local'
const force = process.argv.includes('--force')

const keyOf = line => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]
const source = readFileSync(example, 'utf8')

if (force || !existsSync(target)) {
    writeFileSync(target, source)
    console.log(`wrote ${target}`)
    process.exit(0)
}

const current = readFileSync(target, 'utf8')
const present = new Set(current.split(/\r?\n/).map(keyOf).filter(Boolean))
const missing = source.split(/\r?\n/).filter(line => {
    const key = keyOf(line)
    return key && !present.has(key)
})
if (missing.length === 0) {
    console.log(`${target} is up to date`)
} else {
    writeFileSync(target, `${current.trimEnd()}\n\n# Added from ${example}\n${missing.join('\n')}\n`)
    console.log(`added to ${target}: ${missing.map(keyOf).join(', ')}`)
}
