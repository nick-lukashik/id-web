import { randomUUID } from 'node:crypto'
import { type APIRequestContext, type Page } from '@playwright/test'
import { clearFaults, en, expect, fault, seed, signIn, test } from './fixtures'
import { BACKEND_PORT, SIGN_IN_CODE } from './servers'

const mock = `http://127.0.0.1:${BACKEND_PORT}`

/** A second signed-in device of the same user, so the account page lists one to sign out; its access token. */
async function anotherDevice(request: APIRequestContext, email: string) {
    const sent = await request.post(`${mock}/api/v1/login/email`, {
        data: {
            email,
        },
    })
    const { challengeId } = (await sent.json()) as {
        challengeId: string
    }
    const verified = await request.post(`${mock}/api/v1/login/email/verify`, {
        data: {
            challengeId,
            code: SIGN_IN_CODE,
        },
    })
    const { accessToken } = (await verified.json()) as {
        accessToken: string
    }
    return accessToken
}

/** The two steps of the form, for a sign-in that is already on /login. */
async function signInHere(page: Page, email: string) {
    await page.getByLabel(en.login.email).fill(email)
    await page
        .getByRole('button', {
            name: en.login.send,
        })
        .click()
    await page.getByLabel(en.login.code).fill(SIGN_IN_CODE)
    await page
        .getByRole('button', {
            name: en.login.verify,
        })
        .click()
}

const listItems = (page: Page) => page.getByRole('main').getByRole('listitem')
const showMore = (page: Page) =>
    page.getByRole('link', {
        name: en.states.more,
    })

test.describe('lists page through with "Show more"', () => {
    test('21 payments', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            payments: 21,
        })
        await page.goto('/payments')
        await expect(listItems(page)).toHaveCount(20)
        await expect(page.getByText(/^1 coin ·/)).toHaveCount(0)

        await showMore(page).click()
        await expect(page).toHaveURL(/\/payments\?show=40$/)
        await expect(listItems(page)).toHaveCount(21)
        await expect(page.getByText(/^1 coin ·/)).toBeVisible()
        await expect(showMore(page)).toHaveCount(0)
    })

    test('31 notifications, and marking one read keeps them shown', async ({ page, request }) => {
        const email = await signIn(page)
        // The welcome notification of the new account is the 31st, the oldest.
        await seed(request, email, {
            notifications: 30,
        })
        await page.goto('/notifications')
        await expect(listItems(page)).toHaveCount(30)
        await expect(
            page.getByText(en.notifications.welcome, {
                exact: false,
            }),
        ).toHaveCount(0)

        await showMore(page).click()
        await expect(page).toHaveURL(/\/notifications\?show=60$/)
        await expect(listItems(page)).toHaveCount(31)
        const welcome = listItems(page).filter({
            hasText: en.notifications.welcome,
        })
        await expect(showMore(page)).toHaveCount(0)

        await welcome
            .getByRole('button', {
                name: en.notifications.markRead,
            })
            .click()
        await expect(
            welcome.getByRole('button', {
                name: en.notifications.markRead,
            }),
        ).toHaveCount(0)
        await expect(page).toHaveURL(/\/notifications\?show=60$/)
        await expect(listItems(page)).toHaveCount(31)
    })

    test('52 devices, and signing one out keeps them shown', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            sessions: 51,
        })
        await page.goto('/account')
        const devices = page.getByRole('list', {
            name: en.account.sessions,
        })
        const oldest = devices.getByRole('listitem').filter({
            hasText: /^seed-device-1 /,
        })
        // id-api's page: 50, this device among them.
        await expect(devices.getByRole('listitem')).toHaveCount(50)
        await expect(oldest).toHaveCount(0)

        await showMore(page).click()
        await expect(page).toHaveURL(/\/account\?show=100$/)
        await expect(devices.getByRole('listitem')).toHaveCount(52)
        await expect(showMore(page)).toHaveCount(0)

        await oldest
            .getByRole('button', {
                name: en.account.revoke,
            })
            .click()
        await expect(oldest).toHaveCount(0)
        await expect(page).toHaveURL(/\/account\?show=100$/)
        await expect(devices.getByRole('listitem')).toHaveCount(51)
    })

    test('21 wallet operations', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            tx: 21,
        })
        await page.goto('/wallet')
        const history = page.getByRole('list', {
            name: en.wallet.history,
        })
        await expect(history.getByRole('listitem')).toHaveCount(20)
        await showMore(page).click()
        await expect(page).toHaveURL(/\/wallet\?show=40$/)
        await expect(history.getByRole('listitem')).toHaveCount(21)
        await expect(
            history.getByText('+1', {
                exact: true,
            }),
        ).toBeVisible()
        await expect(showMore(page)).toHaveCount(0)
    })
})

test.describe('a list that did not load says so and can be loaded again', () => {
    test('wallet history unavailable while the balance works', async ({ page, request }) => {
        const email = await signIn(page)
        await fault(request, email, 'GET', '^/api/v1/me/wallet/history$', 503)
        await page.goto('/wallet')
        await expect(
            page.getByText('0 coins', {
                exact: true,
            }),
        ).toBeVisible()
        await expect(page.getByText(en.wallet.historyUnavailable)).toBeVisible()
        await expect(page.getByText(en.wallet.empty)).toHaveCount(0)

        await clearFaults(request, email)
        await page
            .getByRole('link', {
                name: en.states.retry,
            })
            .click()
        await expect(page.getByText(en.wallet.empty)).toBeVisible()
        await expect(page.getByText(en.wallet.historyUnavailable)).toHaveCount(0)
    })

    for (const { path, api, unavailable, loaded } of [
        {
            path: '/payments',
            api: '^/api/v1/me/payments$',
            unavailable: en.payments.unavailable,
            loaded: en.payments.empty,
        },
        {
            path: '/notifications',
            api: '^/api/v1/me/notifications$',
            unavailable: en.notifications.unavailable,
            loaded: en.notifications.welcome,
        },
        {
            path: '/account',
            api: '^/api/v1/me/sessions$',
            unavailable: en.account.sessionsUnavailable,
            loaded: en.account.thisDevice,
        },
    ]) {
        test(`${path}`, async ({ page, request }) => {
            const email = await signIn(page)
            await fault(request, email, 'GET', api, 503)
            await page.goto(path)
            await expect(page.getByText(unavailable)).toBeVisible()

            await clearFaults(request, email)
            await page
                .getByRole('link', {
                    name: en.states.retry,
                })
                .click()
            await expect(page.getByText(loaded)).toBeVisible()
            await expect(page.getByText(unavailable)).toHaveCount(0)
        })
    }

    test('a later call that fails keeps what loaded and offers to try again', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            payments: 101,
        })
        // 120 shown: 100 in the first call (the APIs' most), the rest after its cursor.
        await fault(request, email, 'GET', '^/api/v1/me/payments$', 503, 'cursor=')
        await page.goto('/payments?show=120')
        await expect(listItems(page)).toHaveCount(100)
        await expect(page.getByText(en.states.moreUnavailable)).toBeVisible()
        await expect(showMore(page)).toHaveCount(0)

        await clearFaults(request, email)
        await page
            .getByRole('link', {
                name: en.states.retry,
            })
            .click()
        await expect(listItems(page)).toHaveCount(101)
        await expect(page.getByText(en.states.moreUnavailable)).toHaveCount(0)
    })
})

type Action = {
    name: string
    page: '/account' | '/notifications'
    method: string
    api: string
    button: string
    /** Before the page opens: what the button needs. */
    setup?: (request: APIRequestContext, email: string) => Promise<void>
}

const actions: Action[] = [
    {
        name: 'signing out another device',
        page: '/account',
        method: 'DELETE',
        api: '^/api/v1/me/sessions/[\\w-]+$',
        button: en.account.revoke,
        setup: async (request, email) => {
            await anotherDevice(request, email)
        },
    },
    {
        name: 'signing out everywhere else',
        page: '/account',
        method: 'POST',
        api: '^/api/v1/me/sessions/revoke-others$',
        button: en.account.revokeOthers,
    },
    {
        name: 'saving the profile',
        page: '/account',
        method: 'PATCH',
        api: '^/api/v1/me$',
        button: en.account.save,
    },
    {
        name: 'removing a passkey',
        page: '/account',
        method: 'DELETE',
        api: '^/api/v1/me/passkeys/[\\w-]+$',
        button: en.account.removePasskey,
        setup: (request, email) =>
            seed(request, email, {
                passkeys: 1,
            }),
    },
    {
        name: 'marking a notification read',
        page: '/notifications',
        method: 'POST',
        api: '^/api/v1/me/notifications/[\\w-]+/read$',
        button: en.notifications.markRead,
    },
    {
        name: 'marking all notifications read',
        page: '/notifications',
        method: 'POST',
        api: '^/api/v1/me/notifications/read-all$',
        button: en.notifications.readAll,
    },
]

test.describe('an action the API refuses is never a silent success', () => {
    for (const action of actions) {
        for (const status of [
            401,
            403,
            503,
        ]) {
            test(`${action.name}: ${status}`, async ({ page, request }) => {
                const email = await signIn(page)
                await action.setup?.(request, email)
                await fault(request, email, action.method, action.api, status)
                await page.goto(action.page)
                const button = page.getByRole('main').getByRole('button', {
                    name: action.button,
                    exact: true,
                })
                await button.first().click()

                if (status === 401) {
                    // The session is over: sign in again and come back.
                    await expect(page).toHaveURL(
                        new RegExp(`/login\\?reauth=1&continue=${encodeURIComponent(action.page)}$`),
                    )
                    await expect(page.getByText(en.login.reauthLead)).toBeVisible()
                    return
                }
                await expect(page.getByRole('main').getByRole('alert')).toHaveText(
                    status === 403 ? en.actionErrors.forbidden : en.actionErrors.unavailable,
                )
                // Nothing changed: the button is still there.
                await expect(button.first()).toBeVisible()
            })
        }
    }
})

test('removing a passkey that is gone already counts as done', async ({ page, request }) => {
    const email = await signIn(page)
    await seed(request, email, {
        passkeys: 1,
    })
    await fault(request, email, 'DELETE', '^/api/v1/me/passkeys/[\\w-]+$', 404)
    await page.goto('/account')
    await page
        .getByRole('button', {
            name: en.account.removePasskey,
        })
        .click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})

test.describe('a page whose API says the session is over signs in again', () => {
    for (const { path, api } of [
        {
            path: '/account',
            api: '^/api/v1/me$',
        },
        {
            path: '/account',
            api: '^/api/v1/me/sessions$',
        },
        {
            path: '/account',
            api: '^/api/v1/me/passkeys$',
        },
        {
            path: '/account',
            api: '^/api/v1/me/identities$',
        },
        {
            path: '/wallet',
            api: '^/api/v1/me/wallet$',
        },
        {
            path: '/wallet?currency=EUR',
            api: '^/api/v1/me/wallet/history$',
        },
        {
            path: '/payments',
            api: '^/api/v1/me/payments$',
        },
        {
            path: '/payments/fake/00000000-0000-4000-8000-000000000001',
            api: '^/api/v1/me/payments/[\\w-]+$',
        },
        {
            path: '/notifications',
            api: '^/api/v1/me/notifications$',
        },
    ]) {
        test(`${path}, ${api}`, async ({ page, request }) => {
            const email = await signIn(page)
            await fault(request, email, 'GET', api, 401)
            await page.goto(path)
            await expect(page).toHaveURL(new RegExp(`/login\\?reauth=1&continue=${encodeURIComponent(path)}$`))
            await expect(page.getByText(en.login.reauthLead)).toBeVisible()
        })
    }

    test('a later call of a list too, and the sign-in comes back to the same list', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            payments: 101,
        })
        await fault(request, email, 'GET', '^/api/v1/me/payments$', 401, 'cursor=')
        await page.goto('/payments?show=120')
        await expect(page).toHaveURL(/\/login\?reauth=1&continue=%2Fpayments%3Fshow%3D120$/)

        await clearFaults(request, email)
        await signInHere(page, email)
        await expect(page).toHaveURL(/\/payments\?show=120$/)
        await expect(listItems(page)).toHaveCount(101)
    })

    test('a session another device ended: the sign-in works, and comes back to the page', async ({ page, request }) => {
        const email = await signIn(page)
        const other = await anotherDevice(request, email)
        await request.post(`${mock}/api/v1/me/sessions/revoke-others`, {
            headers: {
                authorization: `Bearer ${other}`,
            },
        })

        await page.goto('/wallet?currency=EUR')
        await expect(page).toHaveURL(/\/login\?reauth=1&continue=%2Fwallet%3Fcurrency%3DEUR$/)
        // A mistake on the way stays on the sign-in, though the old cookie is still there.
        await page.getByLabel(en.login.email).fill(`limited-${email}`)
        await page
            .getByRole('button', {
                name: en.login.send,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toContainText(
            en.login.errors.rate_limited_wait.replace('{when}', 'in 42 seconds'),
        )

        await signInHere(page, email)
        await expect(page).toHaveURL(/\/wallet\?currency=EUR$/)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: en.wallet.heading,
            }),
        ).toBeVisible()
    })
})

test.describe('a checkout with no page to pay on yet', () => {
    const buy = async (page: Page) => {
        await page.goto('/wallet?currency=USD')
        await page
            .getByRole('listitem')
            .filter({
                hasText: '100 coins',
            })
            .getByRole('button', {
                name: en.wallet.buy,
            })
            .click()
    }

    test('still being created: the payments page says so, until a refresh finds it ready', async ({
        page,
        request,
    }) => {
        const email = await signIn(page, 'e2e-', `creating-${randomUUID()}@example.com`)
        await buy(page)
        await expect(page).toHaveURL(/\/payments\?creating=[^&]+&product=[^&]+&currency=[A-Z]+$/)
        await expect(page.getByRole('main').getByRole('status')).toHaveText(en.payments.creating)
        await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
        await expect(
            page.getByText(en.payments.status.creating, {
                exact: true,
            }),
        ).toBeVisible()

        await request.post(`${mock}/payments/created`, {
            data: {
                email,
            },
        })
        await page.reload()
        await expect(page.getByRole('main').getByRole('status')).toHaveCount(0)
        await expect(
            page.getByRole('link', {
                name: en.payments.continue,
            }),
        ).toBeVisible()
    })

    test('still being created: asking again is the same payment, and goes on once the checkout is ready', async ({
        page,
        request,
    }) => {
        const email = await signIn(page, 'e2e-', `creating-${randomUUID()}@example.com`)
        await buy(page)
        const again = page.getByRole('button', {
            name: en.payments.creatingAgain,
        })
        await again.click()
        await expect(page.getByRole('main').getByRole('status')).toHaveText(en.payments.creating)
        await expect(
            page.getByText(en.payments.status.creating, {
                exact: true,
            }),
        ).toHaveCount(1)

        await request.post(`${mock}/payments/created`, {
            data: {
                email,
            },
        })
        // Pressed until it takes: the page has just come back to the same address and may still be settling.
        await expect(async () => {
            await again.click({
                timeout: 2_000,
            })
            await expect(page).toHaveURL(/\/payments\/fake\//, {
                timeout: 2_000,
            })
        }).toPass()
    })

    test('failed: the checkout error', async ({ page }) => {
        await signIn(page, 'e2e-', `lost-${randomUUID()}@example.com`)
        await buy(page)
        await expect(page).toHaveURL(/\/wallet\?error=checkout$/)
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.wallet.checkoutError)
    })
})
