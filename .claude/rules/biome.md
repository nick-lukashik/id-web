Source: official docs (summarized). https://biomejs.dev/reference/cli/, https://biomejs.dev/reference/configuration/, https://biomejs.dev/linter/domains/, https://biomejs.dev/analyzer/suppressions/, https://biomejs.dev/assist/actions/organize-imports/

# Biome 2.6

The Skills in Biome's repository are for Biome contributors, not users. Everything below was checked against
the installed 2.6.4 (CLI help, `biome explain`, and `configuration_schema.json`).

Biome is the only linter and formatter here. Never add ESLint or Prettier (packages, configs, or
`eslint-disable` / `prettier-ignore` comments).

## Commands

- Fix: `pnpm exec biome check --write <paths>` applies formatting, safe lint fixes, and organize-imports.
  Apply unsafe fixes only on purpose (`--write --unsafe`), then review the diff.
- Verify without writing (the same as CI): `pnpm exec biome ci .`
- Narrow a run with `--only=<group|rule|domain>`, `--skip=...`, `--changed`, or `--staged`.
- `pnpm exec biome explain <ruleName>` prints a rule's docs, domains, and fix safety for this exact version.
  Trust it over memory.
- After a Biome upgrade, run `pnpm exec biome migrate --write`.

## Config facts for v2 (`biome.json`)

- `$schema` is `./node_modules/@biomejs/biome/configuration_schema.json`.
- `files.includes` selects files (`ignore` / `include` no longer exist). Globs apply in order. `!pattern`
  excludes a path, and `!!pattern` also keeps the scanner from indexing it. To honor `.gitignore`, set
  `vcs.enabled`, `vcs.clientKind: "git"` and `vcs.useIgnoreFile: true`.
- Import sorting is an assist action, `assist.actions.source.organizeImports`, applied by `check --write`.
  There is no top-level `organizeImports`.
- Framework rules come from `linter.domains`: `next`, `react`, `test`, `playwright`, `tailwind`,
  `tanstackQuery`, `project`, `types`. A domain's recommended rules turn on automatically when its dependency
  is in `package.json`. The `project` and `types` domains turn on slower whole-project scanning.
- Tailwind v4 CSS (`@theme`, `@utility`, `@apply`) needs `css.parser.tailwindDirectives: true` or
  `tailwind.stylesheet`, otherwise it fails to parse.
- The Tailwind rules (`useTailwindSortedClasses` and the others) are nursery and opt-in. They already
  recognize `clsx`, `twMerge`, `cn` (`tailwind.mergeFunctions`) and `cva` (`tailwind.variantFunctions`).
- Use `overrides: [{ includes: [...], linter: { ... } }]` for per-folder settings, for example tests.
- Never loosen a rule or add an exclusion to silence a real finding. Fix the code. Generated files (the
  OpenAPI types) are excluded in `files.includes`, never hand-formatted.

## Style here (`biome.json`, formatter plus `style` rules)

- 4-space indent, line width 120, LF. Single quotes in JS/TS, double quotes in JSX attributes. No
  semicolons (only where ASI needs one). Trailing commas everywhere. `x => x` (no parentheses for one
  parameter). Objects, arrays and imports always expand one item per line (`expand: "always"`), and JSX
  attributes go one per line once there is more than one (`attributePosition: "multiline"`). Operators start
  the continued line. Write new code that way; `pnpm format` does the rest.
- Lint `style` rules at error level: `useImportType` with inline style (`import { type Foo, bar } from ...`),
  `useConsistentArrayType` shorthand (`Foo[]`, not `Array<Foo>`), `useConsistentTypeDefinitions` (`type`, not
  `interface`), `useFilenamingConvention` (kebab-case file names).
- The one accepted exception: module augmentation (`declare module 'next-intl'`, `'@tanstack/react-query'`)
  keeps `interface`, because only interfaces merge. Those lines carry a `biome-ignore` with that reason.
- shadcn/ui components arrive in another style; `pnpm format` converts them. Fix the rest by hand.

## Suppressions (last resort, reason required)

- For the next line: `// biome-ignore lint/<group>/<rule>: <reason>`. With one JSX attribute per line, put it on
  the line above the attribute it is about (`key={index}`), or above the element for element-level rules. For a whole file, put
  `// biome-ignore-all lint/<group>/<rule>: <reason>` at the top. For a range, use `// biome-ignore-start ...`
  and `// biome-ignore-end ...`.
- A suppression without a reason is a parse error, and an unused one is reported.

## Rules you will meet here

- React and Next: `useHookAtTopLevel`, `useExhaustiveDependencies`, `noNextAsyncClientComponent`,
  `noImgElement` (use `next/image`), `noDangerouslySetInnerHtml` (also matters for the CSP).
- Tests: `noFocusedTests` (`.only`) and `noSkippedTests`.
- Playwright: `noPlaywrightMissingAwait`, `noPlaywrightWaitForTimeout`, `noPlaywrightNetworkidle`,
  `noPlaywrightForceOption`.
- TanStack Query: `noTanstackQueryRestDestructuring`. Security: `noSecrets`.
