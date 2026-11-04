import { randomUUID } from 'node:crypto'
import { type BrowserContext, type Page } from '@playwright/test'
import { clearFaults, en, expect, fault, ru, signIn, test } from './fixtures'
import { APP_ORIGIN, BACKEND_PORT, SIGN_IN_CODE } from './servers'

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

/** Step 1 of the email sign-in. */
async function askForCode(page: Page, email: string, lang: 'en' | 'ru' = 'en') {
    const catalog = lang === 'en' ? en : ru
    await page.goto(`/login?lang=${lang}`)
    await page.getByLabel(catalog.login.email).fill(email)
    await page
        .getByRole('button', {
            name: catalog.login.send,
        })
        .click()
}

/** A catalog message as a pattern: each `{placeholder}` matches `fill`. */
const messagePattern = (message: string, fill: string) =>
    new RegExp(`^${message.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, fill)}$`)

test.describe('email code', () => {
    test('a code that could not be sent keeps the email step and says so', async ({ page }) => {
        await askForCode(page, `undeliverable-${randomUUID()}@example.com`)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.delivery_failed)
        await expect(page.getByLabel(en.login.email)).toBeVisible()
        await expect(page.getByLabel(en.login.code)).toHaveCount(0)
    })

    test('a new code waits for the cooldown of the last one', async ({ page }) => {
        await askForCode(page, `e2e-${randomUUID()}@example.com`)
        await expect(page.getByLabel(en.login.code)).toBeVisible()
        await expect(
            page.getByRole('button', {
                name: messagePattern(en.login.resendIn, '\\d+'),
            }),
        ).toBeDisabled()
    })

    test('after the cooldown a new code replaces the last one', async ({ page, request }) => {
        // `resend-`: the mock's cooldown is three seconds.
        const email = `resend-${randomUUID()}@example.com`
        await askForCode(page, email)
        await page
            .getByRole('button', {
                name: en.login.resend,
                exact: true,
            })
            .click()
        await expect(page.getByText(en.login.codeResent.replace('{email}', email))).toBeVisible()
        await page.getByLabel(en.login.code).fill(SIGN_IN_CODE)
        await page
            .getByRole('button', {
                name: en.login.verify,
            })
            .click()
        await expect(page).toHaveURL(/\/account$/)

        const codes = await request.get(
            `http://127.0.0.1:${BACKEND_PORT}/challenges?email=${encodeURIComponent(email)}`,
        )
        const { issued, used } = (await codes.json()) as {
            issued: string[]
            used: string[]
        }
        expect(issued).toHaveLength(2)
        expect(used).toEqual([
            issued[1],
        ])
    })

    test('a soft navigation that finds the cooldown over frees the button', async ({ page }) => {
        // The browser's clock stands still, so its countdown stays where the server put it (a slow
        // browser, for less than a second, in real life).
        await page.clock.setFixedTime(Date.now())
        await askForCode(page, `resend-${randomUUID()}@example.com`)
        await expect(
            page.getByRole('button', {
                name: messagePattern(en.login.resendIn, '\\d+'),
            }),
        ).toBeDisabled()
        await new Promise(resolve => setTimeout(resolve, 3_100))

        // A refresh keeps the component and changes only its `wait`; a redirect from an action
        // remounts the page (Next.js 16.4).
        await page.evaluate(() =>
            (
                window as never as {
                    next: {
                        router: {
                            refresh: () => void
                        }
                    }
                }
            ).next.router.refresh(),
        )
        await expect(
            page.getByRole('button', {
                name: en.login.resend,
                exact: true,
            }),
        ).toBeEnabled()
    })

    test('a rate limit on the code step names the wait and keeps the step', async ({ page }) => {
        await askForCode(page, `verify-limited-${randomUUID()}@example.com`)
        await page.getByLabel(en.login.code).fill(SIGN_IN_CODE)
        await page
            .getByRole('button', {
                name: en.login.verify,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(
            en.login.errors.rate_limited_wait.replace('{when}', 'in 42 seconds'),
        )
        await expect(page.getByLabel(en.login.code)).toBeVisible()
    })

    test('a rate limit names the wait when id-api gives it', async ({ page }) => {
        const email = `limited-${randomUUID()}@example.com`
        await askForCode(page, email)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(
            en.login.errors.rate_limited_wait.replace('{when}', 'in 42 seconds'),
        )
        await expect(page.getByLabel(en.login.email)).toBeVisible()

        await askForCode(page, email, 'ru')
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(
            ru.login.errors.rate_limited_wait.replace('{when}', 'через 42 секунды'),
        )
    })

    test('a rate limit without a wait gets the plain message', async ({ page }) => {
        await askForCode(page, `throttled-${randomUUID()}@example.com`)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.rate_limited)
        await expect(page.getByLabel(en.login.email)).toBeVisible()
    })
})

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

    test('a link started by one account links nothing to another signed in before Google answers', async ({
        page,
        context,
    }) => {
        const first = await signIn(page)
        // The link starts here, not followed to Google (which answers at once); while Google is
        // still open, another tab signs in as someone else.
        const started = await page.request.get('/login/google?intent=link&continue=%2Faccount', {
            maxRedirects: 0,
        })
        expect(started.status()).toBe(303)
        const state = new URL(started.headers().location ?? '').searchParams.get('state') ?? ''
        const other = await context.newPage()
        await other.goto('/account')
        await signOut(other)
        await signIn(other)
        await other.close()

        await page.goto(
            `/login/google/callback?${new URLSearchParams({
                code: `google:${randomUUID()}@gmail.com`,
                state,
            })}`,
        )
        await expect(page).toHaveURL(/\/account\?error=google_session_changed$/)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(
            en.account.googleErrors.google_session_changed,
        )
        await expect(page.getByText(en.account.googleNotLinked)).toBeVisible()
        await signOut(page)
        await signIn(page, 'e2e-', first)
        await expect(page.getByText(en.account.googleNotLinked)).toBeVisible()
    })

    test('signed out while Google is open: the callback says so and links nothing', async ({ page, context }) => {
        const email = await signIn(page)
        // As above: the link starts here, and another tab signs out while Google is still open.
        const started = await page.request.get('/login/google?intent=link&continue=%2Faccount', {
            maxRedirects: 0,
        })
        expect(started.status()).toBe(303)
        const state = new URL(started.headers().location ?? '').searchParams.get('state') ?? ''
        const other = await context.newPage()
        await other.goto('/account')
        await signOut(other)
        await other.close()

        await page.goto(
            `/login/google/callback?${new URLSearchParams({
                code: `google:${randomUUID()}@gmail.com`,
                state,
            })}`,
        )
        await expect(page).toHaveURL(/\/login\?error=google_session_ended&continue=%2Faccount$/)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.google_session_ended)
        await signIn(page, 'e2e-', email)
        await expect(page.getByText(en.account.googleNotLinked)).toBeVisible()
    })

    test('a session that has ended when a link starts signs in again', async ({ page, request }) => {
        const email = await signIn(page)
        const requests = googleRequests(page)
        await fault(request, email, 'GET', '^/api/v1/me$', 401)
        await page
            .getByRole('link', {
                name: en.account.link,
            })
            .click()
        await expect(page).toHaveURL(/\/login\?reauth=1&continue=%2Faccount$/)
        await expect(page.getByText(en.login.reauthLead)).toBeVisible()
        expect(requests).toEqual([])
    })

    test('an account that cannot be read when a link starts does not blame Google', async ({ page, request }) => {
        const email = await signIn(page)
        const requests = googleRequests(page)
        await fault(request, email, 'GET', '^/api/v1/me$', 503)
        await page
            .getByRole('link', {
                name: en.account.link,
            })
            .click()
        await expect(page).toHaveURL(/\/account\?error=unavailable$/)
        expect(requests).toEqual([])

        await clearFaults(request, email)
        await page.reload()
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.actionErrors.unavailable)
    })

    test('an older session signs in again before it links Google', async ({ page, context }) => {
        await nextGoogleAnswer(context, {
            email: `stale-${randomUUID()}@gmail.com`,
        })
        await signIn(page, 'stale-')
        await page
            .getByRole('link', {
                name: en.account.link,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toContainText(
            en.account.googleErrors.google_reauth_required,
        )
        await expect(page.getByText(en.account.googleNotLinked)).toBeVisible()
        await page
            .getByRole('link', {
                name: en.account.reauth,
            })
            .click()
        await expect(page).toHaveURL(/\/login\?reauth=1/)
        await expect(page.getByText(en.login.reauthLead)).toBeVisible()
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
        // Counts the autofill's requests, so a test can wait until one is waiting.
        await page.addInitScript(() => {
            const counted = window as Window & {
                autofillRequests?: number
            }
            const get = navigator.credentials.get.bind(navigator.credentials)
            navigator.credentials.get = options => {
                if (options?.mediation === 'conditional') counted.autofillRequests = (counted.autofillRequests ?? 0) + 1
                return get(options)
            }
        })
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

    /**
     * Clicks the passkey button while the autofill waits for a person. The device
     * turns present between the two: a request already waiting stays waiting (the
     * autofill's), and one that starts afterwards is answered at once (the
     * button's). The other way round, the button's request may wait for ever.
     */
    async function clickThePasskeyButton(
        page: Page,
        device: {
            present: (enabled: boolean) => Promise<unknown>
        },
    ) {
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as Window & {
                                autofillRequests?: number
                            }
                        ).autofillRequests ?? 0,
                ),
            )
            .toBeGreaterThan(0)
        await device.present(true)
        await page
            .getByRole('button', {
                name: en.passkeys.signIn,
            })
            .click()
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
        await clickThePasskeyButton(page, device)
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
        await clickThePasskeyButton(page, device)
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

    test('a site signs out of the whole account through /logout, and back', async ({ page }) => {
        await signIn(page)
        await page.goto(`/logout?return=${encodeURIComponent(`${APP_ORIGIN}/`)}`)
        expect((await landedAtApp(page)).pathname).toBe('/')
        await page.goto('/account')
        await expect(page).toHaveURL(/\/login$/)
    })

    test('a sign-out asked for from outside the platform waits for a click', async ({ page, baseURL }) => {
        await signIn(page)
        await page.goto(`http://127.0.0.1:${BACKEND_PORT}/health`)
        await page.evaluate(
            url => {
                window.location.href = url
            },
            `${baseURL}/logout?return=${encodeURIComponent(`${APP_ORIGIN}/`)}`,
        )
        await expect(
            page.getByRole('heading', {
                name: en.logout.heading,
            }),
        ).toBeVisible()
        // Nothing happened yet.
        await page.goto('/account')
        await expect(page).toHaveURL(/\/account$/)
    })
})
