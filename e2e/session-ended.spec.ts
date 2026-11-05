import { type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { BACKEND_PORT } from '../e2e/servers'
import { en, expect, fault, seed, signIn, test } from './fixtures'

const checksOf = async (request: APIRequestContext, email: string) =>
    (
        (await (
            await request.get(`http://127.0.0.1:${BACKEND_PORT}/session-checks?email=${encodeURIComponent(email)}`)
        ).json()) as {
            checks: number
        }
    ).checks

/** One person on two devices, the second's session just ended from the first. */
async function endedElsewhere(browser: Browser, page: Page) {
    const email = await signIn(page)
    const context = await browser.newContext()
    const elsewhere = await context.newPage()
    await signIn(elsewhere, 'e2e-', email)
    await page.reload()
    await page
        .getByRole('button', {
            name: en.account.revokeOthers,
        })
        .click()
    await expect(page.getByRole('main')).toBeVisible()
    await page.waitForLoadState('networkidle')
    return elsewhere
}

test.describe('a session ended elsewhere', () => {
    test('is over at its next page, and the sign-in comes back there', async ({ browser, page }) => {
        const elsewhere = await endedElsewhere(browser, page)
        await elsewhere.goto('/wallet?currency=EUR')
        await expect(elsewhere).toHaveURL(/\/login\?reauth=1&continue=%2Fwallet%3Fcurrency%3DEUR$/)

        // The device that ended it goes on.
        await page.goto('/account')
        await expect(page).toHaveURL(/\/account$/)
    })

    test('a link inside the site is stopped too', async ({ browser, page }) => {
        const elsewhere = await endedElsewhere(browser, page)
        await elsewhere
            .getByRole('link', {
                name: en.nav.notifications,
            })
            .click()
        await expect(elsewhere).toHaveURL(/\/login\?reauth=1&continue=%2Fnotifications$/)
    })

    test('an action is stopped too, before it reaches the API', async ({ browser, page }) => {
        const elsewhere = await endedElsewhere(browser, page)
        await elsewhere
            .getByRole('button', {
                name: en.account.revokeOthers,
            })
            .click()
        await expect(elsewhere).toHaveURL(/\/login\?reauth=1&continue=%2Faccount$/)
        await page.goto('/account')
        await expect(page).toHaveURL(/\/account$/)
    })
})

test('a page goes on by its token when id-api cannot tell', async ({ page, request }) => {
    const email = await signIn(page)
    await fault(request, email, 'GET', '/api/v1/me/session', 503)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText(email).first()).toBeVisible()
})

test('one check for a page, however many links it prefetches', async ({ page, request }) => {
    const email = await signIn(page)
    const before = await checksOf(request, email)
    await page.goto('/wallet')
    await page.waitForLoadState('networkidle')
    expect(await checksOf(request, email)).toBe(before + 1)
})

test.describe('signing out everywhere else', () => {
    const click = (page: Page) =>
        page
            .getByRole('button', {
                name: en.account.revokeOthers,
            })
            .click()

    const said = (page: Page, text: string) =>
        page.getByRole('status').filter({
            hasText: text,
        })

    test('says when no other device was signed in', async ({ page }) => {
        await signIn(page)
        await click(page)
        await expect(said(page, 'No other devices are signed in.')).toBeVisible()
    })

    test('says how many it ended, and the list shows it', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            sessions: 2,
        })
        await page.reload()
        const rows = page.getByRole('main').getByRole('list').getByRole('listitem')
        await expect(rows).toHaveCount(3)
        await click(page)
        await expect(said(page, 'Ended 2 sessions on other devices.')).toBeVisible()
        await expect(rows).toHaveCount(1)
    })

    test('leaves the sites of this browser, and marks them', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            sites: 1,
        })
        await page.reload()
        const site = page.getByRole('main').getByRole('listitem').filter({
            hasText: en.account.thisBrowser,
        })
        await expect(site).toContainText('nick-lukashik.com')
        await click(page)
        await expect(said(page, 'No other devices are signed in.')).toBeVisible()
        await expect(site).toBeVisible()
    })
})
