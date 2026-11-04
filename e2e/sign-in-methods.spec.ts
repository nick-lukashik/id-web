import { randomUUID } from 'node:crypto'
import { type BrowserContext, type Page } from '@playwright/test'
import { en, expect, signIn, test } from './fixtures'
import { APP_ORIGIN, BACKEND_PORT } from './servers'

/**
 * What "Google" answers next in this browser: the mock backend plays Google's
 * page and reads this cookie (a redirect target cannot be routed by Playwright).
 */
async function nextGoogleAnswer(
    context: BrowserContext,
    answer:
        | {
              email: string
          }
        | {
              error: string
          },
) {
    await context.addCookies([
        {
            name: 'google_answer',
            value: encodeURIComponent('email' in answer ? `email:${answer.email}` : `error:${answer.error}`),
            url: `http://127.0.0.1:${BACKEND_PORT}`,
        },
    ])
}

/** Every request the browser makes to the stand-in of Google. */
function googleRequests(page: Page) {
    const seen: URL[] = []
    page.on('request', request => {
        const url = new URL(request.url())
        if (url.pathname === '/google/authorize') seen.push(url)
    })
    return seen
}

async function signOut(page: Page) {
    await page
        .getByRole('banner')
        .getByRole('button', {
            name: en.nav.signOut,
        })
        .click()
    await expect(page).toHaveURL(/\/login$/)
}

test.describe('Google', () => {
    test('a new Google account signs up and in, with PKCE and a nonce', async ({ page, context }) => {
        const email = `g-${randomUUID()}@gmail.com`
        await nextGoogleAnswer(context, {
            email,
        })
        const requests = googleRequests(page)
        await page.goto('/login?lang=en')
        await page
            .getByRole('link', {
                name: en.login.google,
            })
            .click()
        await expect(page).toHaveURL(/\/account$/)
        await expect(page.getByText(email).first()).toBeVisible()
        await expect(page.getByText(en.account.methodNames.google).first()).toBeVisible()

        const asked = requests[0]
        expect(asked?.searchParams.get('code_challenge_method')).toBe('S256')
        expect(asked?.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
        expect(asked?.searchParams.get('nonce')).toBeTruthy()
        expect(asked?.searchParams.get('scope')).toBe('openid email profile')
    })

    test('an email that has an account links Google only from the account page', async ({ page, context }) => {
        const email = `linked-${randomUUID()}@example.com`
        await signIn(page, 'e2e-', email)
        await signOut(page)

        await nextGoogleAnswer(context, {
            email,
        })
        await page.goto('/login?lang=en')
        await page
            .getByRole('link', {
                name: en.login.google,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.google_link_required)

        await signIn(page, 'e2e-', email)
        await page
            .getByRole('link', {
                name: en.account.link,
            })
            .click()
        await expect(page.getByRole('main').getByText(en.account.linkedGoogle)).toBeVisible()
        await signOut(page)
        await page
            .getByRole('link', {
                name: en.login.google,
            })
            .click()
        await expect(page).toHaveURL(/\/account$/)
    })

    test('a cancelled or forged answer signs nobody in', async ({ page, context }) => {
        await nextGoogleAnswer(context, {
            error: 'access_denied',
        })
        await page.goto('/login?lang=en')
        await page
            .getByRole('link', {
                name: en.login.google,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.google_cancelled)

        // A callback this browser did not start: no pending request, no session.
        await page.goto(`/login/google/callback?code=google:${randomUUID()}@gmail.com&state=forged`)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.google_failed)
        await page.goto('/account')
        await expect(page).toHaveURL(/\/login$/)
    })
})

test.describe('passkeys', () => {
    /**
     * A platform authenticator with user verification in this browser (Chrome
     * DevTools Protocol). While `present` it answers every request at once,
     * the email field's autofill included; switched off, requests wait.
     */
    async function addAuthenticator(page: Page) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('WebAuthn.enable')
        const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: {
                protocol: 'ctap2',
                transport: 'internal',
                hasResidentKey: true,
                hasUserVerification: true,
                isUserVerified: true,
                automaticPresenceSimulation: true,
            },
        })
        return {
            present: (enabled: boolean) =>
                cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
                    authenticatorId,
                    enabled,
                }),
        }
    }

    test('add a passkey, then sign in with it from the autofill or the button, no email', async ({ page }) => {
        const device = await addAuthenticator(page)
        const email = await signIn(page)
        await expect(page.getByText(en.account.noPasskeys)).toBeVisible()
        await page
            .getByRole('button', {
                name: en.passkeys.add,
            })
            .click()
        await expect(page.getByText(en.passkeys.added)).toBeVisible()
        await expect(page.getByText(/Chrome on \w+/)).toBeVisible()

        // The email field offers the passkey, and this authenticator picks it at
        // once: present before the page asks (a request already waiting stays waiting).
        await device.present(false)
        await signOut(page)
        await device.present(true)
        await page.reload()
        await expect(page).toHaveURL(/\/account$/)
        await expect(page.getByText(en.account.methodNames.passkey).first()).toBeVisible()

        // The button, while the autofill waits for a person.
        await device.present(false)
        await signOut(page)
        await page
            .getByRole('button', {
                name: en.passkeys.signIn,
            })
            .click()
        await device.present(true)
        await expect(page).toHaveURL(/\/account$/)
        await expect(page.getByText(email).first()).toBeVisible()

        // Removed here, the passkey on the device no longer signs in.
        await page
            .getByRole('button', {
                name: en.account.removePasskey,
            })
            .click()
        await expect(page.getByText(en.account.noPasskeys)).toBeVisible()
        await device.present(false)
        await signOut(page)
        await page
            .getByRole('button', {
                name: en.passkeys.signIn,
            })
            .click()
        await device.present(true)
        await expect(page.getByText(en.passkeys.errors.unknown)).toBeVisible()
        await device.present(false)
        await expect(page).toHaveURL(/\/login$/)
    })

    test('an older session signs in again before it adds a passkey', async ({ page }) => {
        await addAuthenticator(page)
        await signIn(page, 'stale-')
        await page
            .getByRole('button', {
                name: en.passkeys.add,
            })
            .click()
        await expect(page.getByText(en.passkeys.errors.reauth_required)).toBeVisible()
        await page
            .getByRole('link', {
                name: en.passkeys.reauth,
            })
            .click()
        await expect(page).toHaveURL(/\/login\?reauth=1/)
        await expect(page.getByText(en.login.reauthLead)).toBeVisible()
    })
})

test.describe('sign-in for the other apps', () => {
    const state = 's'.repeat(32)
    const authorize = (extra: Record<string, string> = {}) =>
        `/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: 'landing-web',
            redirect_uri: `${APP_ORIGIN}/auth/callback`,
            state,
            code_challenge: 'c'.repeat(43),
            code_challenge_method: 'S256',
            ...extra,
        })}`

    /** Where the browser landed at the stand-in app (the mock backend serves it). */
    async function landedAtApp(page: Page) {
        await page.waitForURL(url => url.origin === APP_ORIGIN)
        return new URL(page.url())
    }

    test('signs in first, then answers the app with a code and its state', async ({ page }) => {
        await page.goto(authorize())
        await expect(page).toHaveURL(/\/login\?continue=%2Fauthorize/)

        await page.getByLabel(en.login.email).fill(`app-${randomUUID()}@example.com`)
        await page
            .getByRole('button', {
                name: en.login.send,
            })
            .click()
        await page.getByLabel(en.login.code).fill('123456')
        await page
            .getByRole('button', {
                name: en.login.verify,
            })
            .click()
        const landed = await landedAtApp(page)
        expect(landed.pathname).toBe('/auth/callback')
        expect(landed.searchParams.get('code')).toMatch(/^[\w-]{43}$/)
        expect(landed.searchParams.get('state')).toBe(state)

        // Signed in already: straight back, no page.
        await page.goto(authorize())
        expect((await landedAtApp(page)).searchParams.get('code')).not.toBe(landed.searchParams.get('code'))
    })

    test('a silent request without a session gets login_required', async ({ page }) => {
        await page.goto(
            authorize({
                prompt: 'none',
            }),
        )
        const landed = await landedAtApp(page)
        expect(landed.searchParams.get('error')).toBe('login_required')
        expect(landed.searchParams.get('state')).toBe(state)
    })

    test('an unregistered callback is never redirected to', async ({ page }) => {
        await page.goto(
            authorize({
                redirect_uri: 'https://evil.example.test/auth/callback',
            }),
        )
        await expect(
            page.getByRole('heading', {
                name: en.authorize.title,
            }),
        ).toBeVisible()
    })

    test('the hint for the other sites lives as long as the session', async ({ page, context }) => {
        await signIn(page)
        const hint = async () => (await context.cookies()).find(cookie => cookie.name === 'nl_hint')
        expect(await hint()).toMatchObject({
            value: '1',
            httpOnly: true,
            sameSite: 'Lax',
        })
        await signOut(page)
        expect(await hint()).toBeUndefined()
    })
})
