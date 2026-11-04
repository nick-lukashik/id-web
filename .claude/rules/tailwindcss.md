Source: official docs (summarized). https://tailwindcss.com/docs/installation/framework-guides/nextjs, https://tailwindcss.com/docs/theme, https://tailwindcss.com/docs/functions-and-directives, https://tailwindcss.com/docs/detecting-classes-in-source-files, https://tailwindcss.com/docs/upgrade-guide

# Tailwind CSS 4.3

Tailwind Labs publishes no agent rules, Skills or llms.txt. Class names below were checked by compiling them
with the installed 4.3.3.

## Setup (CSS-first)

- The PostCSS plugin is `@tailwindcss/postcss` in `postcss.config.mjs`. The global stylesheet (under
  `src/app/`, the file containing `@import "tailwindcss";`) holds all configuration.
- There is no `tailwind.config.js` and no `content` array. Never create them, and don't add `@config` or JS
  plugins unless asked.
- Design tokens go in `@theme { ... }`. `--color-brand: oklch(...)` gives `bg-brand`, `text-brand`, and so on.
  The other namespaces are `--font-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--breakpoint-*`, and `--spacing`
  (a single base unit). Use `@theme inline` when a token references another CSS variable.
- Theme tokens are also real CSS variables. Write `var(--color-brand)` in CSS and `bg-(--my-var)` in classes.
- Custom utilities use `@utility name { ... }`, not `@layer utilities`.
- Tailwind finds classes by scanning source files as plain text and skips gitignored files. Add other paths
  with `@source "...";`.

## Writing classes

- Never build class names dynamically (`bg-${color}-500`). Map each prop value to a complete static string.
- Merge conditional classes with `cn` (`@/lib/utils`, the `cn` package: clsx + tailwind-merge semantics).
  Build component variants with `class-variance-authority` (`cva`, `VariantProps`).
- Prefer semantic theme tokens over arbitrary values (`w-[317px]`) and raw palette colors. Colors here are
  the shadcn/ui tokens in `src/app/globals.css` (`bg-background`, `bg-card`, `bg-muted`,
  `text-muted-foreground`, `text-destructive`, `border-input`, `ring-ring`, ...).
- One light theme: no `dark:` classes, no `.dark` rules, no `light-dark()`, no `prefers-color-scheme`
  (`src/app/light-theme.test.ts` checks `src/`). Without a `.dark` variant, Tailwind's `dark:` follows the OS
  and would make the page half dark. A new color = a new token with AA contrast (axe checks it in e2e).
- Don't use inline `style={...}`: the nonce CSP may block style attributes (see `nextjs.md`). Use classes or an
  `@utility`.

## v3 habits to drop

- Use the v4 names: `shadow-xs` (v3 `shadow-sm`), `shadow-sm` (v3 `shadow`), `rounded-xs` / `rounded-sm` (v3
  `rounded-sm` / `rounded`), `blur-xs` (v3 `blur-sm`), `outline-hidden` (v3 `outline-none`), `ring-3` (bare
  `ring` is now 1px), `bg-linear-to-r` (v3 `bg-gradient-to-r`), `shrink-*` / `grow-*`.
- Opacity utilities are gone (`bg-opacity-50`, `text-opacity-*`). Use modifiers such as `bg-black/50`.
- The default border and ring color is `currentColor`, so always give a color: `border border-gray-200`.
- The important modifier goes at the end (`bg-red-500!`). Stacked variants apply left to right.
- `@apply` inside CSS modules or a separate stylesheet needs `@reference "<global css path>";` first.
- Built in now: container queries (`@container`, `@md:flex`), `size-*`, `not-*`, `inert:`, `starting:`,
  `field-sizing-content`, `text-shadow-*`.

## Tooling

- Biome parses Tailwind at-rules only with `css.parser.tailwindDirectives: true` (or `tailwind.stylesheet` in
  `biome.json`). Otherwise it reports "Tailwind-specific syntax is disabled".
- Class sorting is Biome's `useTailwindSortedClasses` (nursery, opt-in, unsafe fix). Don't add the Prettier
  plugin.
