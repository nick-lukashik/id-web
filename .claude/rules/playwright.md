Source: https://playwright.dev/docs/test-agents and the Skills shipped in node_modules/playwright-core/lib/tools/skills/ (playwright-cli, playwright-trace, playwright-component-testing). Rules condensed from those plus https://playwright.dev/docs/best-practices, https://playwright.dev/docs/test-webserver, https://playwright.dev/docs/accessibility-testing

# Playwright Test 1.64 and @axe-core/playwright 4.14

Official agent tooling. Optional, and the owner decides. Re-run both commands after a Playwright upgrade.
- `npx playwright init-skills` copies the three shipped Skills into `.claude/skills/` (`--loop=agents` copies
  them into `.agents/skills/` instead).
- `npx playwright init-agents --loop=claude` generates the planner, generator and healer test agents.

## Running (agent-safe)

- Run `PLAYWRIGHT_HTML_OPEN=never pnpm exec playwright test`, or the package script with that variable, so
  the HTML report never opens and blocks.
- Narrow a run with a file path, `-g "<title>"`, `--project=<name>` or `--last-failed`.
- To debug a failure, read the trace without a browser: `npx playwright trace open <trace.zip>`, then
  `trace actions`, `trace errors`, `trace requests`, `trace console`, and `trace close` when done.
- For interactive debugging, run `playwright test --debug=cli` in the background, attach with
  `npx playwright cli attach <session>`, and stop it afterwards.
- If browsers are missing, `npx playwright install chromium` downloads them. Ask first.

## Project setup

- Tests live in `e2e/` and run against the production build (standalone server), started by `webServer` in
  `playwright.config.ts` (once with `ROBOTS=index`, once with `noindex`). Don't switch e2e to `next dev`.
- A site that adds the API also adds the mock API server and its fixtures (next-example): `page.route()` intercepts
  only browser requests, server-side calls reach the mock.
- Use `baseURL` with relative paths: `page.goto('/')`.
- Never set `bypassCSP: true`. E2E must exercise the real nonce CSP. Failing on unexpected `console` errors
  catches CSP violations.
- For i18n, cover `?lang=` and the locale cookie (`context.addCookies`). `test.use({ locale: 'ru-RU' })` sets
  `Accept-Language`, which decides nothing: use it to check that such a first visit is still in English. Take
  UI strings from the messages JSON (`e2e/fixtures.ts` exports `en` and `ru`), not hardcoded copies.
- Import `test`/`expect` from `./fixtures`: it fails the test on any CSP violation in the console.

## Writing tests

- Find elements with `getByRole(..., { name })` first, then `getByLabel` or `getByText`, and `getByTestId` as a
  last resort. No CSS or XPath chains, and no `nth()` unless order is the behavior under test.
- Use web-first assertions only: `await expect(locator).toBeVisible()`, `toHaveText`, `toHaveURL`,
  `toHaveTitle`. Use `toMatchAriaSnapshot` for region structure.
- Never use `waitForTimeout`, `waitForSelector`, `waitForNavigation`, `networkidle`, `{ force: true }`,
  `page.$` / `$eval` / element handles, or a committed `page.pause()`. Biome's playwright domain flags these,
  and also flags missing `await`.
- Each test gets a fresh context, so never depend on test order. Share setup with fixtures (`test.extend`).
  Use `test.step` for readable reports.

## Accessibility (axe)

```ts
import AxeBuilder from '@axe-core/playwright'

const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
expect(results.violations).toEqual([])
```

- Scan once the page is in the state under test (for example, with the dialog open). Narrow the scope with
  `.include()` / `.exclude()`.
- `.disableRules([...])` needs a comment explaining why. Scan every locale. The UI has one light theme, so
  there is no color-scheme matrix.
