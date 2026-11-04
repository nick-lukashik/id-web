import { en, expect, signIn, test } from './fixtures'
import { BACKEND_PORT } from './servers'

test.describe('signed out', () => {
    for (const path of [
        '/',
        '/account',
        '/wallet',
        '/payments',
        '/notifications',
    ]) {
        test(`${path} sends to the sign-in`, async ({ page }) => {
            await page.goto(path)
            await expect(page).toHaveURL(/\/login$/)
        })
    }

    test('a wrong code is refused and the form stays on the code step', async ({ page }) => {
        await page.goto('/login?lang=en')
        await page.getByLabel(en.login.email).fill('wrong-code@example.com')
        await page
            .getByRole('button', {
                name: en.login.send,
            })
            .click()
        await page.getByLabel(en.login.code).fill('000000')
        await page
            .getByRole('button', {
                name: en.login.verify,
            })
            .click()
        await expect(page.getByRole('main').getByRole('alert')).toHaveText(en.login.errors.invalid_code)
        await expect(page.getByLabel(en.login.code)).toBeVisible()
    })
})

test.describe('signed in', () => {
    test('the session cookie is HttpOnly and the tokens never reach the page', async ({ page, context }) => {
        await signIn(page)
        const session = (await context.cookies()).find(cookie => cookie.name === 'id_session')
        expect(session?.httpOnly).toBe(true)
        expect(session?.sameSite).toBe('Lax')
        expect(await page.content()).not.toMatch(/at\.[0-9a-f]{8}-/)
        expect(await page.evaluate(() => document.cookie)).not.toContain('id_session')
    })

    test('the proxy refreshes an expiring access token and rotates the cookie', async ({ page, context, request }) => {
        const refreshes = async () =>
            (
                (await (await request.get(`http://127.0.0.1:${BACKEND_PORT}/calls`)).json()) as {
                    refresh: number
                }
            ).refresh
        await signIn(page, 'short-')
        const cookie = async () => (await context.cookies()).find(item => item.name === 'id_session')?.value
        const before = await cookie()
        const count = await refreshes()

        await page.goto('/wallet')
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: en.wallet.heading,
            }),
        ).toBeVisible()
        expect(await refreshes()).toBeGreaterThan(count)
        const after = await cookie()
        expect(after).toBeDefined()
        expect(after).not.toBe(before)

        // The rotated cookie is the one that works next.
        await page.goto('/account')
        await expect(page).toHaveURL(/\/account$/)
    })

    test('profile, then sign-out', async ({ page }) => {
        const email = await signIn(page)
        await expect(page.getByText(email).first()).toBeVisible()
        await page.getByLabel(en.account.displayName).fill('Nick')
        await page
            .getByRole('button', {
                name: en.account.save,
            })
            .click()
        await expect(page.getByRole('main').getByText(en.account.saved)).toBeVisible()
        await expect(page.getByLabel(en.account.displayName)).toHaveValue('Nick')

        await page
            .getByRole('banner')
            .getByRole('button', {
                name: en.nav.signOut,
            })
            .click()
        await expect(page).toHaveURL(/\/login$/)
        await page.goto('/account')
        await expect(page).toHaveURL(/\/login$/)
    })

    test('buy a pack with the test provider: balance, history, payment and notification', async ({ page }) => {
        await signIn(page)
        await page.goto('/wallet?currency=USD')
        await expect(
            page.getByText('0 coins', {
                exact: true,
            }),
        ).toBeVisible()
        await page
            .getByRole('listitem')
            .filter({
                hasText: '100 coins',
            })
            .getByRole('button', {
                name: en.wallet.buy,
            })
            .click()

        await expect(page).toHaveURL(/\/payments\/fake\/[\w-]+$/)
        await expect(page.getByText('$1.00')).toBeVisible()
        await page
            .getByRole('button', {
                name: en.fakePay.pay,
            })
            .click()

        await expect(page).toHaveURL(/\/wallet\?paid=1$/)
        await expect(page.getByRole('main').getByRole('status')).toHaveText(en.wallet.paid)
        await expect(
            page
                .getByText('100 coins', {
                    exact: true,
                })
                .first(),
        ).toBeVisible()
        await expect(page.getByText('+100')).toBeVisible()

        await page.goto('/payments')
        await expect(page.getByText(en.payments.status.succeeded)).toBeVisible()

        await page.goto('/notifications')
        await expect(page.getByText(/100 coins credited, balance 100 coins/)).toBeVisible()
        await page
            .getByRole('button', {
                name: en.notifications.readAll,
            })
            .click()
        await expect(
            page.getByRole('button', {
                name: en.notifications.markRead,
            }),
        ).toHaveCount(0)
    })
})
