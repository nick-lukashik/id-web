# id-web

The account site of the platform, `https://id.nick-lukashik.com`: sign-in (email code, passkey, Google), profile, sign-in methods and signed-in devices, the coin wallet, payments, the in-app notifications, and sign-in for the platform's other sites. It is the only part of the account services the browser talks to; the APIs behind it are reachable from the cluster only.

Built from [`next-starter`](https://github.com/nick-lukashik/next-starter): SEO, strict CSP, EN/RU without a locale in the URL, health probes, tests, Dockerfile and CI work as described there. The design of the whole account part (tokens, flows, events) is [`docs/identity.md`](https://github.com/nick-lukashik/.github/blob/master/docs/identity.md) in the org repo.

| Page | What | Calls |
|---|---|---|
| `/login` | email code (step 1 email, step 2 the code), a passkey, Google; `continue` is where to go after it, `reauth=1` signs in again while signed in | `id-api` |
| `/login/google`, `/login/google/callback` | the round trip to Google (sign-in, or `intent=link`) | `id-api` |
| `/account` | profile, sign-in methods (Google, passkeys), signed-in devices, sign out here or everywhere else | `id-api` |
| `/authorize` | sign-in for the other sites: a one-time code for their callback | `id-api` |
| `/logout` | sign-out from the other sites, and back to them; `/logout/confirm` for a request from outside | `id-api` |
| `/wallet` | balance, history, coin packs to buy if `PAYMENTS_ENABLED` | `wallet-api`, `pay-api` |
| `/payments` | the person's payments; `/payments/fake/<id>` is the checkout of the test provider; 404 unless `PAYMENTS_ENABLED` | `pay-api` |
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
| `pnpm test:e2e` | Playwright against the build, on the mock backend (run `pnpm build` first); `PW_SITE_PORT`, `PW_NOINDEX_PORT`, `PW_BACKEND_PORT` and `PW_APP_PORT` move its servers, so two runs on one machine do not collide (not a bad port of the Fetch spec such as 4190: Node's fetch and the browser refuse those) |
| `pnpm test` | unit tests |
| `pnpm lint` / `pnpm format` | Biome check / fix |

## How sign-in works here

```
browser ──cookie──▶ id-web (Server Components, Server Actions, proxy) ──Bearer──▶ *-api
```

- **No tokens in the browser.** The session cookie `__Host-id_session` (`id_session` on plain http) holds `{ accessToken, accessExpiresAt, refreshToken, sessionId }` sealed with AES-256-GCM under `SESSION_SECRET` (`src/lib/session/seal.ts`). It is `HttpOnly`, `SameSite=Lax`, `Path=/`, 30 days. The purpose (`session`, `login`) is bound as associated data, so one cookie cannot stand in for the other.
- **Sign-in.** Every method ends in `startSession` (`src/lib/session/start.ts`): the tokens go into the session cookie, the hint for the other sites is set, and a previous session of this browser ends (signing in again to confirm it is you replaces it).
  - Email code: `startLogin` (Server Action) asks `id-api` for a code and keeps the challenge, its `resendAfter` and `continue` in a second sealed cookie, `__Host-id_login`, for 10 minutes. `deliveryStatus: failed` means no code is coming: step 1 stays, with the error and no cookie. `resendLogin` (the button on step 2, disabled until `resendAfter`) asks for a new code for the email in the cookie; the new challenge replaces the old one, and if it was not delivered the old code still works and only `resendAfter` moves. `verifyLogin` sends the code. A 429 on any of them says how long to wait when `id-api`'s limiter names it (`?wait=<seconds>`).
  - Passkey: `src/components/passkey-sign-in.tsx` runs the ceremony with `@simplewebauthn/browser`; the options and the answer go through Server Actions (`src/app/actions/passkeys.ts`). The email field offers passkeys in its autofill too. `Permissions-Policy` allows `publickey-credentials-get` and `-create` for this origin only.
  - Google: a link (not a form) to `/login/google`, which seals state, nonce and the PKCE verifier into `__Host-id_google` and sends the browser to Google; `/login/google/callback` checks the state and hands the code to `id-api`.
  - `continue` is checked by `safeContinue` (`src/lib/session/continue.ts`): only paths of this site.
- **Other sites.** `/authorize` (`src/app/authorize/page.tsx`) checks the site and its exact callback with `id-api`, sends the person to `/login?continue=…` if needed, then redirects to the callback with a 60-second code and the site's state. `prompt=none` (silent sign-in) shows no page: without a session the callback gets `error=login_required`. The hint cookie `nl_hint=1` (`src/lib/session/hint.ts`) lives on the parent domain as long as the session here, so the other sites know when to try.
- **Refresh.** `src/proxy.ts` opens the cookie on every page request. With less than 60 s left on the access token it calls `id-api POST /v1/sessions/refresh` under the request id it gives the request, puts the new cookie on the request (so the page renders with it) and on the response. A refused refresh clears the cookie; an unreachable `id-api` keeps it for the next request. Parallel requests of one page may refresh at once: `id-api` answers the token issued just before with the same new pair for 20 s.
- **Pages and mutations.** Server Components read the session (`currentSession`, `requireSession` in `src/lib/session/current.ts`) and call the APIs through `backend()` (`src/lib/backend/backend.ts`: 10 s budget, JSON, the access token; of the browser's request only its address, user agent and request id are forwarded). Every change is a Server Action with Zod-checked input. Next.js checks the `Origin` of Server Actions, and their bodies are capped at 1 MiB.
- **Lists.** `loadList` (`src/lib/backend/list.ts`) follows `nextCursor` until it has the `?show=` items a page asks for; "Show more" is a link to a page more, so it works without JavaScript. A list that did not load says so, with a link to try again, instead of looking empty.
- **Refusals.** `src/lib/backend/action-error.ts`: a 401 on an action or on a page's own call means the session is over, so the person signs in again and comes back (`refused`, `signInAgainOn401`); any other refusal of an action goes back to its page with the reason in `?error=` (`forbidden`, `not_found`, `rate_limited`, `unavailable`, `failed`), which the page shows as `actionErrors.*`.
- **Payments.** All of it only with `PAYMENTS_ENABLED`, where `pay-api` runs: without it there is no link or top-up, and the pages and the actions answer 404. The pack form carries an idempotency key made when the page renders, so a double submit is one checkout. `startCheckout` redirects only to an http(s) URL returned by `pay-api`. If `pay-api` answers `creating` (another request with that key is still making the provider's checkout), the person goes to `/payments?creating=1`, which says so until a refresh finds the payment ready; `failed` is the checkout error on `/wallet`.
- **Sign-out is for the whole account.** `endSession` ends the session at id-api, which also ends every other site's session signed in from it, then clears the cookie and the hint. The other sites' "Sign out" end their own session and send the browser to `/logout?return=<their page>` (an origin of `FORM_ACTION_ORIGINS`); a request from outside the platform (`Sec-Fetch-Site: cross-site`) gets a confirmation page with one button instead.
- **CSP `form-action`.** Browsers apply it to the redirects after a form too. A sign-in started before JavaScript loads ends with a redirect to the site that asked (`/authorize`), and a payment with one to the provider: those origins go into `FORM_ACTION_ORIGINS`. With JavaScript the router navigates there itself.

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
| `GTM_ID` | none | per request; Google Tag Manager container (`GTM-ABC1234`). Unset: no tag manager, and the CSP stays on this origin. Consent Mode starts at denied |
| `ID_API_URL`, `WALLET_API_URL`, `PAY_API_URL`, `NOTIFICATIONS_API_URL` | `http://<api>.prod.svc` | at startup |
| `SESSION_SECRET` | none, required (32+ characters, the same on every replica) | at startup; `next build` runs without it |
| `FORM_ACTION_ORIGINS` | none | at startup; other origins a form may end on, space-separated: the sites that sign in here (`https://nick-lukashik.com`) and the payment provider's checkout |
| `PAYMENTS_ENABLED` | `false` | at startup; `true` only where `pay-api` runs: coin packs, the payment pages and their actions |

## Tests

- Unit (Vitest): the seal (tampering, wrong purpose, wrong key), `continue` paths, the hint domain, `/authorize` requests, passkey errors and names, env, CSP, robots, catalogs.
- e2e (Playwright, `e2e/`) on the production build with `e2e/mock-backend.mjs`, which keeps the routes and response shapes of the four APIs and id-api's refresh rotation with its 20 s grace:
  - signed out: every private page goes to `/login`, a wrong code is refused;
  - signed in: the cookie is `HttpOnly` and no token reaches the page, profile and sign-out, buying a pack with the test provider through to the balance, history, payment and notification;
  - the email code: a code that could not be sent, a new code after the cooldown (`resend-` emails wait 3 s), the countdown after a soft navigation, a 429 with and without a wait on either step;
  - the proxy refreshes an expiring token under its request id and rotates the cookie (emails starting with `short-` get 30 s tokens);
  - Google: sign-up with PKCE and a nonce, an existing email only linked from the account page, a link that another account or a sign-out interrupted, a session or an account that fails when a link starts, a cancelled or forged answer (the mock plays Google's page);
  - states: "Show more" on payments, notifications, wallet history and devices; a list that did not load; every action refused with 401, 403 and 503; a 401 on any page's own call; a checkout that is `creating` or `failed`; `PAYMENTS_ENABLED` unset, actions included;
  - passkeys with Chrome's virtual authenticator: add one, sign in from the autofill and from the button, a removed one is unknown, an old session signs in again first (emails starting with `stale-`);
  - `/authorize`: sign-in first, then a code and the state for the site's callback; `prompt=none` without a session; an unregistered callback; the hint cookie;
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
- ConfigMap `id-web-config`: `SITE_URL=https://id.nick-lukashik.com`, `ROBOTS`, the four `*_API_URL`, `FORM_ACTION_ORIGINS=https://nick-lukashik.com`, and `PAYMENTS_ENABLED=true` only where `pay-api` is deployed (prod leaves it unset for now). SealedSecret `id-web-secrets`: `SESSION_SECRET`.
- NetworkPolicy: `components/web` labels the pods as API clients; each api admits them.
- The APIs must be up first (`docs/identity.md`, "Deploy prerequisites").

## Limitations

- One OG image, in English: link previews arrive without the locale cookie.
- Rotating `SESSION_SECRET` signs everyone out (no key list yet).
- A list shows at most 1000 items (`MAX_SHOWN`): every "Show more" loads from the newest again.
- A passkey removed here stays on the device until the person deletes it there (the WebAuthn Signal API is a later step); signing in with it says it is unknown.
- The e2e mock checks no WebAuthn signature (id-api's integration tests do, with a software authenticator).
