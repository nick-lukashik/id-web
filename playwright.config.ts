import { defineConfig, devices } from '@playwright/test'
import { APP_ORIGIN, BACKEND_PORT, HTTPS_COOKIES_PORT, NOINDEX_PORT, SITE_PORT } from './e2e/servers'

// The suite runs against the production build (`pnpm build` first), started
// below three times: ROBOTS=index with PAYMENTS_ENABLED=true, ROBOTS=noindex with
// PAYMENTS_ENABLED unset (the default), and with an https SITE_URL for the cookies
// of prod, all on the in-memory backends of e2e/mock-backend.mjs. PW_BASE_URL
// points it at a running site instead.
const external = process.env.PW_BASE_URL
// localhost, not 127.0.0.1: passkeys need a domain (an IP is no WebAuthn RP ID).
const baseURL = external ?? `http://localhost:${SITE_PORT}`
const backendURL = `http://127.0.0.1:${BACKEND_PORT}`
const site = (port: number, host: string, env: Record<string, string>) => ({
    // The same server.js the container runs.
    command: 'node scripts/start-standalone.mjs',
    url: `http://127.0.0.1:${port}/health/live`,
    env: {
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        SITE_URL: `http://${host}:${port}`,
        APP_VERSION: 'e2e',
        LOG_LEVEL: 'warn',
        ID_API_URL: backendURL,
        WALLET_API_URL: backendURL,
        PAY_API_URL: backendURL,
        NOTIFICATIONS_API_URL: backendURL,
        // Test only: the sealed cookies of this run.
        SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
        FORM_ACTION_ORIGINS: APP_ORIGIN,
        ...env,
    },
    reuseExistingServer: false,
    timeout: 60_000,
})

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    expect: {
        timeout: 7_000,
    },
    reporter: process.env.CI
        ? [
              [
                  'list',
              ],
              [
                  'html',
                  {
                      open: 'never',
                  },
              ],
          ]
        : [
              [
                  'list',
              ],
          ],
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],
    webServer: external
        ? undefined
        : [
              {
                  command: 'node e2e/mock-backend.mjs',
                  url: `${backendURL}/health`,
                  env: {
                      PORT: String(BACKEND_PORT),
                      SITE_URL: `http://localhost:${SITE_PORT}`,
                      APP_CALLBACK: `${APP_ORIGIN}/auth/callback`,
                  },
                  reuseExistingServer: false,
                  timeout: 30_000,
              },
              site(SITE_PORT, 'localhost', {
                  ROBOTS: 'index',
                  PAYMENTS_ENABLED: 'true',
              }),
              site(NOINDEX_PORT, '127.0.0.1', {
                  ROBOTS: 'noindex',
              }),
              site(HTTPS_COOKIES_PORT, 'localhost', {
                  SITE_URL: `https://localhost:${HTTPS_COOKIES_PORT}`,
              }),
          ],
})
