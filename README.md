# id-web

The account site of the platform, `https://id.nick-lukashik.com`: sign-in by email code, profile and signed-in devices, the GRM wallet, payments and the in-app notifications. It is the only part of the account services the browser talks to; the APIs behind it are reachable from the cluster only.

Built from [`next-starter`](https://github.com/nick-lukashik/next-starter): SEO, strict CSP, EN/RU without a locale in the URL, health probes, tests, Dockerfile and CI work as described there. The design of the whole account part (tokens, flows, events) is [`docs/identity.md`](https://github.com/nick-lukashik/.github/blob/master/docs/identity.md) in the org repo.

| Page | What | Calls |
|---|---|---|
| `/login` | step 1 email, step 2 the 6-digit code | `id-api` |
| `/account` | profile, signed-in devices, sign out here or everywhere else | `id-api` |
| `/wallet` | balance, GRM packs to buy, history | `wallet-api`, `pay-api` |
| `/payments` | the person's payments; `/payments/fake/<id>` is the checkout of the test provider | `pay-api` |
| `/notifications` | the inbox, mark read | `notifications-api` |

`/` redirects to `/account` or `/login`. Only `/login` is public and in the sitemap; the rest redirect to it when signed out and say `noindex`.

## Getting started

Requires Node 26 and pnpm 12.

```bash
pnpm install
pnpm env:local          # .env.local from .env.example; set SESSION_SECRET
pnpm mock-backend       # the four APIs in memory on :3190, sign-in code 123456
pnpm dev                # http://localhost:3100
```

Against the real services, point `*_API_URL` at them instead (each runs on its own port, see its README).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev server on `:3100` |
| `pnpm mock-backend` | `e2e/mock-backend.mjs`: id-api, wallet-api, pay-api, notifications-api in memory |
| `pnpm build` / `pnpm start` | standalone build and running it |
| `pnpm verify` | Biome + `next typegen && tsc` + Vitest + build |
| `pnpm test:e2e` | Playwright against the build, on the mock backend (run `pnpm build` first) |
| `pnpm test` | unit tests |
| `pnpm lint` / `pnpm format` | Biome check / fix |

## How sign-in works here

```
browser ──cookie──▶ id-web (Server Components, Server Actions, proxy) ──Bearer──▶ *-api
```

- **No tokens in the browser.** The session cookie `__Host-id_session` (`id_session` on plain http) holds `{ accessToken, accessExpiresAt, refreshToken, sessionId }` sealed with AES-256-GCM under `SESSION_SECRET` (`src/lib/session/seal.ts`). It is `HttpOnly`, `SameSite=Lax`, `Path=/`, 30 days. The purpose (`session`, `login`) is bound as associated data, so one cookie cannot stand in for the other.
- **Sign-in.** `startLogin` (Server Action) asks `id-api` for a code and keeps the challenge in a second sealed cookie, `__Host-id_login`, for 10 minutes. `verifyLogin` sends the code; on success the tokens go into the session cookie and the login cookie goes.
- **Refresh.** `src/proxy.ts` opens the cookie on every page request. With less than 60 s left on the access token it calls `id-api POST /v1/sessions/refresh`, puts the new cookie on the request (so the page renders with it) and on the response. A refused refresh clears the cookie; an unreachable `id-api` keeps it for the next request. Parallel requests of one page may refresh at once: `id-api` answers the token issued just before with the same new pair for 20 s.
- **Pages and mutations.** Server Components read the session (`currentSession`, `requireSession` in `src/lib/session/current.ts`) and call the APIs through `backend()` (`src/lib/backend/backend.ts`: 10 s budget, JSON, the access token, the client address for rate limits; nothing the browser sent is forwarded). Every change is a Server Action with Zod-checked input. Next.js checks the `Origin` of Server Actions, and their bodies are capped at 1 MiB.
- **Payments.** The pack form carries an idempotency key made when the page renders, so a double submit is one checkout. `startCheckout` redirects only to an http(s) URL returned by `pay-api`.
- **Sign-out.** `id-api POST /v1/sessions/logout` with the refresh token, then the cookie is cleared.

What this site never does: read `Authorization` from the browser, expose an `/api` proxy, or render a token into the page (an e2e test checks the last one).

## Health semantics

| Probe | Answers | Body |
|---|---|---|
| `GET /health/live` | `200` while the process answers; reads no dependency | `{ status: 'ok', version }` |
| `GET /health/ready` | `200` when this server can render (it answered, its config parsed) | `{ status: 'ok', version }` |

Both return `x-app-version`, which the post-deploy smoke check waits for. Readiness does not call the APIs: a page that cannot reach one says so, and the pod stays in rotation (contract, kind web). The Docker `HEALTHCHECK` uses `/health/ready`.

## Environment variables

| Variable | Default | Read |
|---|---|---|
| `SITE_URL` | `http://localhost:3000` | at startup; `https://` turns on the `__Host-` cookies |
| `APP_VERSION` | `dev` | at startup (`x-app-version` header) |
| `LOG_LEVEL` | `info` | at startup |
| `ROBOTS` | `index` | per request; `noindex` blocks indexing (stage) |
| `ID_API_URL`, `WALLET_API_URL`, `PAY_API_URL`, `NOTIFICATIONS_API_URL` | `http://<api>.prod.svc` | at startup |
| `SESSION_SECRET` | none, required (32+ characters, the same on every replica) | at startup; `next build` runs without it |

## Tests

- Unit (Vitest): the seal (tampering, wrong purpose, wrong key), env, CSP, robots, catalogs.
- e2e (Playwright, `e2e/`) on the production build with `e2e/mock-backend.mjs`, which keeps the routes and response shapes of the four APIs and id-api's refresh rotation with its 20 s grace:
  - signed out: every private page goes to `/login`, a wrong code is refused;
  - signed in: the cookie is `HttpOnly` and no token reaches the page, profile and sign-out, buying a pack with the test provider through to the balance, history, payment and notification;
  - the proxy refreshes an expiring token and rotates the cookie (emails starting with `short-` get 30 s tokens);
  - language, SEO, CSP and axe on every page, signed in where needed.

## Docker

```bash
docker build --build-arg APP_VERSION=$(git rev-parse HEAD) -t id-web .
docker run --rm -p 3000:3000 -e SITE_URL=http://localhost:3000 \
  -e SESSION_SECRET="$(openssl rand -base64 32)" \
  -e ID_API_URL=http://host.docker.internal:3190 -e WALLET_API_URL=http://host.docker.internal:3190 \
  -e PAY_API_URL=http://host.docker.internal:3190 -e NOTIFICATIONS_API_URL=http://host.docker.internal:3190 id-web
```

The image is the starter's: standalone output, uid `10001`, read-only root filesystem, `/tmp` and `.next/cache` writable.

## Dependency updates

Versions are pinned exactly. [Renovate](https://docs.renovatebot.com/) (`renovate.json`, the same policy in every repo) opens PRs on Monday early morning (`Asia/Tbilisi`): one PR for all non-major updates, one per major, weekly lockfile maintenance. Releases younger than 3 days are skipped, the same as pnpm's `minimumReleaseAge` in `pnpm-workspace.yaml`.

## CI

`.github/workflows/ci.yml` calls the org reusable workflows from `nick-lukashik/.github` by the moving major tag `@v1`, never `@master`:

- job `ci`: `build.yml@v1` with `kind: web`. In one job it runs `pnpm verify`, then `pnpm test:e2e` on that same build (Playwright: the mock backend and two servers, `ROBOTS=index` and `noindex`), then builds the image with `APP_VERSION=<full SHA>`; on `master` it pushes the image to GHCR and outputs its digest. A change to docs only (`docs/`, `.claude/`, `*.md` at the root) skips all of it. The required check is `ci / verify`.
- job `deploy`: on `master`, when an image was pushed: `deploy-pr.yml@v1` opens the gitops PR with the new digest. Secrets are passed explicitly, never `secrets: inherit`.

## Deploy

The image follows the [service runtime contract](https://github.com/nick-lukashik/.github/blob/master/docs/service-contract.md) (kind **web**).

- gitops: `apps/id-web/prod/` with `components/service`, `components/web` and `components/subdomain` (`id`). At least two replicas (HPA 2 to 4), so the session lives only in the cookie and `SESSION_SECRET` is shared.
- ConfigMap `id-web-config`: `SITE_URL=https://id.nick-lukashik.com`, `ROBOTS`, the four `*_API_URL`. SealedSecret `id-web-secrets`: `SESSION_SECRET`.
- NetworkPolicy: `components/web` labels the pods as API clients; each api admits them.
- The APIs must be up first (`docs/identity.md`, "Deploy prerequisites").

## Limitations

- One OG image, in English: link previews arrive without the locale cookie.
- Sign-in by email code only; passkeys, Google and sign-in for other sites (OAuth with PKCE) are later steps.
- Rotating `SESSION_SECRET` signs everyone out (no key list yet).
- Lists show the first page only (20 or 30 items); the APIs already return a cursor.
- Without JavaScript, the redirect from "Buy" to an external provider page is blocked by `form-action 'self'`; with JavaScript the router navigates there itself. When the Lava adapter goes live, its checkout origin goes into `form-action` (`src/lib/security/csp.ts`).
