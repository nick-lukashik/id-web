// Ports of the servers playwright.config.ts starts; specs and fixtures read them from here.
// PW_SITE_PORT, PW_NOINDEX_PORT, PW_HTTPS_COOKIES_PORT, PW_BACKEND_PORT and PW_APP_PORT move them,
// so two runs on one machine do not collide. Not a "bad port" of the Fetch spec (4190, 6000...): Node's fetch and
// the browser refuse to call those.

const port = (name: string, fallback: number) => Number(process.env[name] || fallback)

/** The site, ROBOTS=index and PAYMENTS_ENABLED=true (the default baseURL). */
export const SITE_PORT = port('PW_SITE_PORT', 3100)
/** The same build again with ROBOTS=noindex and PAYMENTS_ENABLED unset: both are runtime config. */
export const NOINDEX_PORT = port('PW_NOINDEX_PORT', 3101)
/**
 * The same build with an https SITE_URL, so its cookies have the `__Host-` names
 * of prod. It serves plain http: Chromium accepts Secure cookies on localhost.
 */
export const HTTPS_COOKIES_PORT = port('PW_HTTPS_COOKIES_PORT', 3102)
/** e2e/mock-backend.mjs: id-api, wallet-api, pay-api and notifications-api in memory. */
export const BACKEND_PORT = port('PW_BACKEND_PORT', 3190)
/** The code the mock accepts for every sign-in. */
export const SIGN_IN_CODE = '123456'
/** A stand-in for an app that signs in through this site (nick-lukashik.com); the specs play it. */
export const APP_ORIGIN = `http://localhost:${port('PW_APP_PORT', 3300)}`
