Source: https://vitest.dev/guide/learn/writing-tests-with-ai (official AI guidance), https://vitest.dev/llms.txt (official LLM docs index), plus https://vitest.dev/guide/migration for v5 changes

# Vitest 5

## Running

- Always run once, never in watch mode: `pnpm exec vitest run`, `vitest run src/lib/foo.test.ts`, or
  `vitest run -t "<name>"`. Vitest tries to detect agents and CI, but the official guide calls that fragile.
- Reports and artifacts go to `.vitest/` (gitignored). The json and junit reporters write files there, not to stdout.

## Scope in this project

- Unit tests sit next to the code as `*.test.ts` under `src/`. The environment is `node`, and jsdom and
  Testing Library are not installed.
- Unit-test logic: lib code, Zod schemas, key factories, API client helpers, the i18n setup. Vitest can't render
  async Server Components, so Playwright covers pages.
- The default `include` (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) would also pick up `e2e/` specs. Keep `include`
  limited to `src/**` (or exclude `e2e/**`) in the Vitest config.
- Vite resolves the `@/*` alias (Vite 8 `resolve.tsconfigPaths: true`, or an explicit `resolve.alias`). Check
  `vitest.config.*` before changing anything. Don't add `vite-tsconfig-paths`.
- Under Vitest, a module that imports `server-only` throws on import. Put `vi.mock('server-only', () => ({}))`
  at the top of the test file instead of deleting the import.
- Never depend on the real environment. Use `vi.stubEnv('API_URL', 'http://localhost:4010')`, then import the
  env module dynamically, and reset with `vi.unstubAllEnvs()` (or `unstubEnvs: true` in config).

## Writing tests (official AI guidance)

- Use Vitest APIs only: `vi.fn`, `vi.spyOn`, `vi.mock`, never `jest.*`. Globals are off, so import `describe`,
  `it`, `test`, `expect` and `vi` from `vitest`.
- Assert real values (`toEqual`, `toMatchObject`, `toThrow(/msg/)`), not `toBeDefined()`. Test behavior, not
  internals.
- Don't over-mock. Use the project's real modules and mock only I/O (network, time, env).
- Cover edge cases on purpose: empty input, `null`/`undefined`, boundaries, error paths, rejected promises.
- Parametrize with `test.for([...])('formats $locale', ({ locale }) => ...)` instead of copying tests.
- Keep names short and about behavior ("rejects invalid API_URL"), not "should correctly ...".
- Mock modules with `vi.mock(import('./mod'), ...)` for type safety, at the file top level only. Vitest 5
  throws for `vi.mock` / `vi.hoisted` nested in blocks. Use `vi.doMock` for dynamic cases.
- Fake time with `vi.useFakeTimers()` and `vi.setSystemTime(...)`, then restore with `vi.useRealTimers()`.
- Run the tests before you finish. Generated tests often import things that don't exist.

## Vitest 5 changes that bite

- `clearMocks` now defaults to `true`: call history is cleared before every test, and implementations stay.
  Don't assert on calls made in `beforeAll` or at module scope.
- `restoreMocks` is still `false`. Restore spies with `vi.restoreAllMocks()` in `afterEach`, or enable
  `restoreMocks` in config.
- An unawaited `expect(p).resolves` / `.rejects` now fails the test. Always `await` it.
- `test.sequential` / `describe.sequential` were removed. Use `{ concurrent: false }`.
- `expect.poll` fails when it times out. `toThrow('')` matches any message.
- Entrypoints were removed: `vitest/reporters` and `vitest/coverage` moved to `vitest/node`, and
  `vitest/environments` and `vitest/snapshot` moved to `vitest/runtime`.
- Vitest no longer searches parent directories for a config. Run it from the project root.
