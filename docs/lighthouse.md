# Lighthouse

Target: 100 in every Lighthouse category, on mobile and desktop.

## Last measurement (2026-11-04, Lighthouse 13.6)

| Page | Performance | Accessibility | Best Practices | SEO | Agentic Browsing |
|---|---|---|---|---|---|
| `https://nick-lukashik.com/` (landing-web), before the canonical fix | 100 | 100 | 100 | 92 | 100 |
| `landing-web` production build, after it | 100 | 100 | 100 | 100 | 100 |

The SEO gap was one audit, `canonical`: the bare path `/` pointed its canonical at `/?lang=en`, which is also listed as the `en` hreflang alternate. Now every URL of the hreflang cluster is its own canonical (`canonicalPath` in `src/lib/seo/alternates.ts`, set by the proxy as `x-canonical-path`):

- `?lang=xx` points to itself;
- the bare path (`x-default`, by the cookie, English without one) points to the bare path.

`og:url` follows the same value.

## What keeps the score at 100

- **Performance.** Pages are server-rendered and have no client data fetching on load. The only client components are the small interactive ones, such as the language switch. Fonts are the system stack (`--font-sans` in `globals.css`), so there is no web-font request or layout shift. The pages have no raster images; when one is added, it goes through `next/image` with `width`, `height` and `sizes`. No third-party scripts run.
- **Accessibility.** The shadcn/ui tokens pass contrast, and every control has a name from the catalogs. axe runs on every page in e2e (`e2e/a11y.spec.ts`), so a regression fails CI before Lighthouse would see it.
- **Best Practices.** HTTPS everywhere. The nonce CSP has no `unsafe-inline` scripts, security headers are set in `next.config.ts`, and the console stays clean.
- **SEO.** The page has a title, description, self-referencing canonical, hreflang (`en`, `ru`, `x-default`), `robots.txt`, `sitemap.xml` and JSON-LD. `ROBOTS=noindex` turns indexing off at runtime, for stage.

## Measuring

Against the production build, with Chrome installed:

```bash
pnpm build
PORT=3917 HOSTNAME=127.0.0.1 SITE_URL=http://127.0.0.1:3917 APP_VERSION=lh node scripts/start-standalone.mjs &
npx -y lighthouse@13.6.0 http://127.0.0.1:3917/ --quiet --chrome-flags="--headless=new" --view
npx -y lighthouse@13.6.0 http://127.0.0.1:3917/ --preset=desktop --quiet --chrome-flags="--headless=new" --view
kill %1
```

Live pages go through Cloudflare. Measure them the same way with the public URL. A dip in Performance of one or two points between runs is network noise, not a regression.
