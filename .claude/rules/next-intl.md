Source: https://next-intl.dev/docs/workflows/agents (official agent guidance). Setup and API from https://next-intl.dev/docs/getting-started/app-router, https://next-intl.dev/docs/usage/configuration, https://next-intl.dev/docs/workflows/typescript, https://next-intl.dev/docs/environments/testing

# next-intl 4.14, without i18n routing

## How it is wired here

- There is no `[locale]` segment, no `next-intl/middleware`, no `defineRouting` and no `createNavigation`. URLs
  carry no locale.
- `src/proxy.ts` resolves the locale once, in this order: `?lang=` override, then the cookie, then English
  (`src/i18n/resolve.ts`). `Accept-Language` decides nothing: a first visit is in English, whatever the
  browser's language. Never add locale detection.
- `src/i18n/request.ts` uses `getRequestConfig` (from `next-intl/server`) to return `{ locale, messages }` from
  that result. Check values with `hasLocale(locales, value)`. Set `timeZone` so server and client format dates
  the same way. `createNextIntlPlugin()` (from `next-intl/plugin`, in `next.config.ts`) finds
  `./src/i18n/request.ts` by default.
- The root layout renders `<html lang={await getLocale()}>` and wraps children in `<NextIntlClientProvider>`
  with no props. Rendered from a Server Component, it inherits `locale`, `messages`, `now` and `timeZone`.
- Reading cookies or headers in the request config makes every page dynamic. That is expected here, since the
  CSP nonce needs it anyway.

## Conventions (from the official agent page, adapted)

- Every user-facing string comes from `useTranslations` / `getTranslations`, including `aria-label`, `alt`,
  `title`, metadata and error messages. Never hardcode UI text.
- Every key used must exist in both `src/i18n/messages/en.json` and `src/i18n/messages/ru.json`. The two files
  have identical key sets, so add, rename and delete keys in both files in the same change.
- Use short, descriptive keys grouped by namespace (`HomePage.title`), never the English sentence.
- Pass values as ICU arguments, not string concatenation, so translators can reorder words:
  `t('greeting', { name })` with `"Hello, {name}!"`.
- Agents translate catalogs poorly (missing context, drifting terms, plural rules). Write the Russian
  strings carefully and list new or changed `ru` strings in the PR for human review.

## Usage

- Non-async components (server or client) use `const t = useTranslations('Namespace')`. Async Server
  Components, `generateMetadata`, Route Handlers and Server Actions use
  `const t = await getTranslations('Namespace')` from `next-intl/server`.
- Prefer non-async shared components: they work on both sides and are easier to unit test.
- `t.rich('key', { b: (chunks) => <b>{chunks}</b> })` returns rich text. `t.markup` returns an HTML string,
  `t.has('key')` checks a key exists, and `t.raw` reads the raw value.
- Russian plurals need `one` (1, 21), `few` (2-4, 22-24), `many` (5-20, 25) and `other` (fractions):
  `{count, plural, one {...} few {...} many {...} other {...}}`. English needs `one` and `other`.
- Format dates and numbers with `useFormatter()` / `await getFormatter()`: `format.dateTime`, `format.number`,
  `format.relativeTime`, `format.list`. Never call `toLocaleString()` or `Intl.*` directly in components,
  because server and client output can differ.
- Get the current locale from `useLocale()` / `await getLocale()`. The `Locale` type comes from `next-intl`.
- To switch language, set the locale cookie in a Server Action or Route Handler (cookies can't be set during
  render), or navigate with `?lang=`. Reuse the existing cookie-name constant; never add a new literal.

## Types and tests

- Strict keys come from `declare module 'next-intl' { interface AppConfig { Locale: ..., Messages: typeof en } }`
  (`src/i18n/next-intl.d.ts`; it stays an `interface`, with a Biome suppression, because it must merge).
  A type error on `t('x')` means the key is missing, so add it to both JSON files.
- In unit tests, wrap components in `<NextIntlClientProvider locale="en" messages={en}>`. Vitest needs
  `server.deps.inline: ['next-intl']` only if `createNavigation` is used, which it is not here.
- `useExtracted` (inline messages extracted at build time) is the official alternative for agents. This
  project uses explicit keys, so don't mix the two styles.
