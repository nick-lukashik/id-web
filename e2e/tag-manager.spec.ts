import { type Page } from '@playwright/test'
import { en, expect, NOINDEX_URL, test } from './fixtures'

const SCRIPT = 'https://www.googletagmanager.com/gtm.js**'
const CONTAINER = 'https://www.googletagmanager.com/gtm.js?id=GTM-E2ETEST'

/** The container's script, answered here: the tests stay off the network. */
async function stubContainer(page: Page) {
    const requested: string[] = []
    await page.route(SCRIPT, route => {
        requested.push(route.request().url())
        return route.fulfill({
            contentType: 'text/javascript',
            body: '',
        })
    })
    return requested
}

const banner = (page: Page) =>
    page.getByRole('region', {
        name: en.consent.label,
    })

/** Pressed until the page has come alive: the button is there before its handler is. */
const pressOk = (page: Page) =>
    expect(async () => {
        await banner(page)
            .getByRole('button', {
                name: en.consent.ok,
            })
            .click()
        await expect(banner(page)).toBeHidden({
            timeout: 500,
        })
    }).toPass()

const consentCookie = async (page: Page) =>
    (await page.context().cookies()).find(cookie => cookie.name === 'nl_consent')

const hasLayer = (page: Page) => page.evaluate(() => 'dataLayer' in window)

// The fixture fails any test on a CSP violation: the script and its load are checked by that too.
test.describe('with GTM_ID', () => {
    test.skip(!NOINDEX_URL, 'the server with GTM_ID is started by playwright.config.ts')

    test('the container loads on the first visit, and the banner stays until "OK"', async ({ page }) => {
        const requested = await stubContainer(page)
        const response = await page.goto(`${NOINDEX_URL}/`)
        await expect
            .poll(() => requested)
            .toEqual([
                CONTAINER,
            ])
        await expect(banner(page)).toBeVisible()
        expect(response?.headers()['content-security-policy']).toContain('https://*.google-analytics.com')
        const first = await page.evaluate(() =>
            Array.from(
                (
                    window as unknown as {
                        dataLayer: ArrayLike<unknown>[]
                    }
                ).dataLayer[0] ?? [],
            ),
        )
        expect(first.slice(0, 2)).toEqual([
            'consent',
            'default',
        ])
        expect(first[2]).toMatchObject({
            analytics_storage: 'granted',
            ad_storage: 'denied',
        })

        await pressOk(page)
        await expect
            .poll(() => consentCookie(page))
            .toMatchObject({
                value: 'true',
                httpOnly: true,
            })
        const expires = (await consentCookie(page))?.expires ?? 0
        expect(expires).toBeGreaterThan(Date.now() / 1000 + 360 * 86_400)
        await page.reload()
        await expect.poll(() => requested).toHaveLength(2)
        await expect(banner(page)).toBeHidden()
    })

    test('"OK" is the only button, and its answer has nothing to render', async ({ page }) => {
        await stubContainer(page)
        await page.goto(`${NOINDEX_URL}/`)
        await expect(banner(page).getByRole('button')).toHaveCount(1)
        const answer = page.waitForResponse(`${NOINDEX_URL}/consent`)
        await pressOk(page)
        expect((await answer).status()).toBe(204)
    })

    test('an answer of the old banner shows the new one, and statistics run', async ({ page, context }) => {
        const requested = await stubContainer(page)
        await context.addCookies([
            {
                name: 'nl_consent',
                value: 'denied',
                url: NOINDEX_URL as string,
            },
        ])
        await page.goto(`${NOINDEX_URL}/`)
        await expect(banner(page)).toBeVisible()
        await expect.poll(() => requested).toHaveLength(1)
    })

    test('a form on another site cannot press it', async ({ page, context }) => {
        const response = await page.request.post(`${NOINDEX_URL}/consent`, {
            headers: {
                'sec-fetch-site': 'cross-site',
            },
        })
        expect(response.status()).toBe(403)
        expect((await context.cookies()).map(cookie => cookie.name)).not.toContain('nl_consent')
    })
})

test('without GTM_ID there is no banner, nothing loads and the CSP stays on this origin', async ({ page }) => {
    const requested = await stubContainer(page)
    const response = await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(banner(page)).toHaveCount(0)
    expect(requested).toEqual([])
    expect(await hasLayer(page)).toBe(false)
    expect(response?.headers()['content-security-policy']).not.toContain('google')
})
