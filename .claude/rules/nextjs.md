Source: node_modules/next/dist/docs/01-app/02-guides/ai-agents.md (https://nextjs.org/docs/app/guides/ai-agents), https://github.com/vercel/next.js/tree/canary/skills

# Next.js 16.4 (App Router)

Official guidance: your training data predates this version. Before writing Next.js code, read the relevant
page in the version-matched docs at `node_modules/next/dist/docs/` (the managed block in root `AGENTS.md`
points there too) and heed deprecation notices. Online: append `.md` to any nextjs.org/docs URL, or use
https://nextjs.org/docs/llms.txt.

Optional official Skill (workflow, not reference): `npx skills add vercel/next.js --skill next-dev-loop`
verifies edits against a running `next dev` through `/_next/mcp` plus a browser. The Cache Components /
Partial Prefetching skills do not fit this project (nonce CSP, see below).

## Docs to read first (under `node_modules/next/dist/docs/01-app/`)

- Proxy: `03-api-reference/03-file-conventions/proxy.md`. CSP and nonces: `02-guides/content-security-policy.md`
- Route Handlers and proxying a backend: `01-getting-started/15-route-handlers.md`, `02-guides/backend-for-frontend.md`
- Env vars: `02-guides/environment-variables.md`. Next 16 breaking changes: `02-guides/upgrading/version-16.md`
- Standalone and self-hosting: `03-api-reference/05-config/01-next-config-js/output.md`, `02-guides/self-hosting.md`
- TypeScript (TS 7, route type helpers): `03-api-reference/05-config/02-typescript.md`

## Next 16 facts (checked against 16.4.4; the project pins 16.4.3)

- Interception lives in `src/proxy.ts`, which exports `proxy()` plus an optional constant `config.matcher`.
  `middleware.ts` is deprecated. Proxy always runs on Node.js, and a `runtime` export there throws.
- Request APIs are async only: `await params`, `await searchParams`, `await cookies()`, `await headers()`,
  `await draftMode()`. Sync access has been removed.
- Type routes with the global helpers (no import needed): `PageProps<'/blog/[slug]'>`, `LayoutProps<'/'>`,
  `RouteContext<'/api/[...path]'>`. `next dev`, `next build` or `next typegen` generate them. To type-check,
  run `next typegen && tsc --noEmit`.
- TypeScript 7 has no JS compiler API, so `next build` runs the project `tsc` CLI (the default). Never set
  `experimental.useTypeScriptCli: false`. The CLI also checks tests and `.next/dev/types` if tsconfig includes them.
- Cookies can be set only in Server Functions or Route Handlers, never while a Server Component renders.
- `next lint` is gone, and `next build` does not lint. Use Biome.
- `reactCompiler` and `typedRoutes` are top-level config keys, not `experimental`. Turbopack is the default for
  dev and build, so don't add a `webpack()` config (the build fails).
- `revalidateTag(tag, profile)` needs its second argument. `serverRuntimeConfig`, `publicRuntimeConfig`
  and AMP have been removed.
- `next-env.d.ts` is generated, and the docs say to gitignore it. Never edit it.

## Project rules

- Code lives in `src/app` and is imported via `@/*` (`src/*`). Components are Server Components by default. Put
  `'use client'` on the smallest interactive leaf. Client components cannot be `async`.
- `src/proxy.ts` sets a strict CSP with a fresh nonce on every request. That has these consequences:
  - Every page must render dynamically. Never opt into static output (`export const dynamic = 'force-static'`,
    `'use cache'`, `cacheComponents`, PPR). Prerendered HTML has no nonce, so its scripts get blocked.
  - No hand-written inline `<script>` and no script via `dangerouslySetInnerHTML`. Next adds the nonce to its own
    scripts. Extra scripts must use `next/script` with `nonce={(await headers()).get('x-nonce') ?? undefined}`.
    The one exception is structured data: `src/components/json-ld.tsx` (escaped JSON, carries the nonce).
  - `style-src` has no `'unsafe-inline'`, so server-rendered `style` attributes are blocked. That includes the
    inline styles `next/image` emits (for example with `fill`). Prefer Tailwind classes. Styles set in the
    browser through the DOM are not affected. A runtime `<style>` element without a nonce needs its hash in
    `STYLE_HASHES` (`src/lib/security/csp.ts`; Sonner is the one case), never `'unsafe-inline'`.
  - `connect-src` is same-origin: browser code may only call `/api/*`.
  - The CSP header belongs only in the proxy. The static security headers stay in `next.config.ts` `headers()`.
- Data path: browser → `/api/*` Route Handler → backend at `API_URL`. Never expose `API_URL` or call the
  backend from client code. Server code uses the typed client in `src/lib/api/`.
- Env: read `process.env` only in `src/lib/env/` (exceptions: `src/proxy.ts` and `src/instrumentation.ts` read
  `APP_VERSION`, `NODE_ENV`, `NEXT_RUNTIME`, because `server-only` modules cannot load there). Next inlines
  `NEXT_PUBLIC_*` at build time, and only for literal `process.env.NEXT_PUBLIC_X` accesses. The project has none:
  environment-specific values (`API_URL`, `SITE_URL`, `ROBOTS`) are server env read at runtime, so one image
  serves stage and prod.
- Metadata: a page exports only `title` and `description` (`generateMetadata` with `getTranslations`). The root
  layout derives canonical, hreflang alternates and `og:url` from the `x-pathname` header the proxy sets, and
  Next copies title/description into Open Graph and Twitter. A page that sets its own `openGraph` must spread
  `await baseOpenGraph(path)` (`src/lib/seo/metadata.ts`), because metadata merges shallowly.
- `notFound()` answers 404 only if nothing streamed before it: no `loading.tsx` above a route that can 404
  (the notes list keeps its `loading.tsx` inside the `(list)` route group for that reason).
- Server-only modules start with `import 'server-only'`.
- `output: 'standalone'`: production runs `node .next/standalone/server.js`, not `next start`. Copy `public/` and
  `.next/static` next to it (see `output.md`).

## Verify

- While `next dev` runs, `/_next/mcp` exposes `get_errors`, `get_routes`, `compile_route` and
  `get_compilation_issues` (via `next-devtools-mcp` or the next-dev-loop Skill). Use them instead of a full build.
- Before finishing: `next typegen && tsc --noEmit`, `biome check`, unit tests, then `next build`.
