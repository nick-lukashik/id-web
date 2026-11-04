// Ports of the servers playwright.config.ts starts; specs and fixtures read them from here.

/** The site, ROBOTS=index and PAYMENTS_ENABLED=true (the default baseURL). */
export const SITE_PORT = 3100
/** The same build again with ROBOTS=noindex and PAYMENTS_ENABLED unset: both are runtime config. */
export const NOINDEX_PORT = 3101
/** e2e/mock-backend.mjs: id-api, wallet-api, pay-api and notifications-api in memory. */
export const BACKEND_PORT = 3190
/** The code the mock accepts for every sign-in. */
export const SIGN_IN_CODE = '123456'
/** A stand-in for an app that signs in through this site (nick-lukashik.com); the specs play it. */
export const APP_ORIGIN = 'http://localhost:3300'
