Source: https://ui.shadcn.com/docs/cli, https://ui.shadcn.com/docs/components-json, https://ui.shadcn.com/docs/theming, https://ui.shadcn.com/llms.txt. CLI facts checked against the installed shadcn 4.23 (`pnpm exec shadcn --help`).

# shadcn/ui 4 (Radix base, Tailwind v4)

shadcn/ui is not a dependency you import: the CLI copies component source into `src/components/ui/`, and
the code is ours from then on. Official agent tooling: `pnpm exec shadcn docs <component>` prints a
component's docs and examples, and `pnpm exec shadcn mcp init` sets up the shadcn MCP server (the owner decides).

## Setup here

- `components.json`: style `radix-vega`, base colour `neutral`, CSS variables, icons `lucide`, aliases
  `@/components/ui` (components), `@/lib/utils` (`cn`), `@/hooks`.
- `cn` comes from the `cn` package (the CLI default, replaces clsx + tailwind-merge). Generated components
  import it from `cn`; app code imports it from `@/lib/utils`.
- Primitives come from the `radix-ui` package (`import { Slot } from 'radix-ui'`). Icons from `lucide-react`.
- The CLI is a pinned devDependency: run `pnpm exec shadcn ...`, not `pnpm dlx shadcn@latest` (Renovate
  updates the pin). `shadcn/tailwind.css` and `tw-animate-css` are imported by `src/app/globals.css`.
- Installed: button, card. next-example also has input, textarea, label, field, separator, skeleton, sonner.

## Adding or updating a component

1. `pnpm exec shadcn add <name>` (`--dry-run` / `--diff` to preview; `--overwrite` to replace a local copy,
   which discards our edits).
2. Delete every `dark:` class it brought, and any `.dark` block it added to `globals.css`. The site has one
   light theme, and without a `.dark` variant Tailwind would apply `dark:` when the OS is dark.
   `src/app/light-theme.test.ts` fails until they are gone.
3. `pnpm format`, then fix what Biome still reports in the code (never loosen `biome.json`).
4. Check the CSP (below), then `pnpm verify` and `pnpm test:e2e`.

## Using components

- Links styled as buttons: `<Button asChild><Link href="/">...</Link></Button>`.
- Forms: `Field`, `FieldLabel htmlFor`, `FieldDescription id`, `FieldError id` (`role="alert"`), and set
  `data-invalid` on `Field`, `aria-invalid` and `aria-describedby` on the control (next-example,
  `src/app/notes/_components/create-note-form.tsx`). There is no react-hook-form.
- Toasts: Sonner, added with the API (next-example): `<Toaster>` in `src/app/providers.tsx`, its stylesheet hash
  in the CSP.
- Colours: only the tokens in `globals.css` (`bg-background`, `text-muted-foreground`, `text-destructive`,
  `border-input`, ...). A component that needs a new token: add it there, light value only, AA contrast.
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
