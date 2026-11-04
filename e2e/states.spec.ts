import { type APIRequestContext, type Page } from '@playwright/test'
import { clearFaults, en, expect, fault, seed, signIn, test } from './fixtures'
import { BACKEND_PORT, SIGN_IN_CODE } from './servers'

const mock = `http://127.0.0.1:${BACKEND_PORT}`

/** A second signed-in device of the same user, so the account page lists one to sign out. */
async function anotherDevice(request: APIRequestContext, email: string) {
    const sent = await request.post(`${mock}/api/v1/login/email`, {
        data: {
            email,
        },
    })
    const { challengeId } = (await sent.json()) as {
        challengeId: string
    }
    await request.post(`${mock}/api/v1/login/email/verify`, {
        data: {
            challengeId,
            code: SIGN_IN_CODE,
        },
    })
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
        setup: anotherDevice,
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
                const reason =
                    action.page === '/account'
                        ? en.account.error
                        : status === 403
                          ? en.actionErrors.forbidden
                          : en.actionErrors.unavailable
                await expect(page.getByRole('main').getByRole('alert')).toHaveText(reason)
                // Nothing changed: the button is still there.
                await expect(button.first()).toBeVisible()
            })
        }
    }
})
