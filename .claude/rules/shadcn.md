Source: https://ui.shadcn.com/docs/cli, https://ui.shadcn.com/docs/components-json, https://ui.shadcn.com/docs/theming, https://ui.shadcn.com/llms.txt. CLI facts checked against the installed shadcn 4.23 (`pnpm exec shadcn --help`).

# shadcn/ui 4 (Radix base, Tailwind v4)

The components come from `@nick-lukashik/ui` (repository `packages`, folder `ui`): shadcn/ui restyled in
Mono Brutal, the design of nick-lukashik.com, plus the kit's own blocks (section heads, filter list, wordmark,
roulette). The site owns no copies. Official agent tooling: `pnpm exec shadcn docs <component>` prints a
component's docs and examples, and `pnpm exec shadcn mcp init` sets up the shadcn MCP server (the owner decides).

## Setup here

- Import each component from its own file: `import { Button } from '@nick-lukashik/ui/button'`,
  `@nick-lukashik/ui/brand/wordmark`, `@nick-lukashik/ui/next` (`RouteRoulette`). The index re-exports
  everything, and importing from it ships every client component of the kit to the browser.
- `src/app/globals.css` imports `@nick-lukashik/ui/styles.css` (tokens, theme, utilities, the shadcn variants)
  with `source(none)` and `@source` lines that name `src/` and the kit files this site renders. A newly used
  kit file goes into that `@source` list, or its classes are missing.
- `cn` comes from `@/lib/utils` (the `cn` package). Icons from `lucide-react`.
- The package comes from GitHub Packages (`.npmrc`, the `packages` README, "Installing"); Renovate updates it.

## Adding or updating a component

1. In `packages/ui`: `pnpm exec shadcn add <name>` in a scratch app, copy the file into `src/components/`, restyle
   it (no `dark:` classes, square corners, `ring-1 ring-ring` focus, titles in `font-heading` caps) until
   `components.test.ts` passes, and add it to the showcase (`pnpm demo`).
2. Release the kit (bump `version`, merge, tag `v<version>`), then update the version here.
3. Add the file to the `@source` list in `globals.css`. Check the CSP (below), then `pnpm verify` and
   `pnpm test:e2e`.

## Using components

- Links styled as buttons: `<Button asChild><Link href="/">...</Link></Button>`.
- Forms: `Field`, `FieldLabel htmlFor`, `FieldDescription id`, `FieldError id` (`role="alert"`), and set
  `data-invalid` on `Field`, `aria-invalid` and `aria-describedby` on the control (next-example,
  `src/app/notes/_components/create-note-form.tsx`). There is no react-hook-form.
- Toasts: Sonner, added with the API (next-example): `<Toaster>` in `src/app/providers.tsx`, its stylesheet hash
  in the CSP.
- Colours: only the kit's tokens (`bg-background`, `text-muted-foreground`, `text-soft`, `border-line`,
  `text-destructive`, ...). A new token goes into the kit (`ui/src/styles/tokens.css`), one value, AA contrast.
- Every visible or accessible string comes from next-intl, including labels shadcn hardcodes (for example
  the `Spinner` component's `aria-label="Loading"`; use a `lucide-react` icon instead).

## CSP

- Production `style-src` has a nonce and no `'unsafe-inline'`: a `style` attribute in server-rendered HTML is
  blocked. Styles React sets in the browser (after hydration, through the DOM) are not.
- So avoid components or props that render `style` on the server. Radix parts that do: `VisuallyHidden`
  (and what uses it, such as Select's native fallback), Popper-positioned content when open on first render,
  ScrollArea, NavigationMenu viewport. Check the HTML of a new component with `curl` before relying on it.
- A component that injects a `<style>` element (Sonner does) needs its stylesheet's hash in
  `STYLE_HASHES` (`src/lib/security/csp.ts`); `csp.test.ts` shows how to compute it.
- `pnpm test:e2e` fails on any CSP violation in the console.
