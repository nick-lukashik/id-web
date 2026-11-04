import { type Page } from '@playwright/test'
import { expect, NOINDEX_URL, test } from './fixtures'

const SCRIPT = 'https://www.googletagmanager.com/gtm.js**'

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

// The fixture fails any test on a CSP violation: the script and its load are checked by that too.
test('with GTM_ID the container loads, consent denied first', async ({ page }) => {
    test.skip(!NOINDEX_URL, 'the server with GTM_ID is started by playwright.config.ts')
    const requested = await stubContainer(page)
    const response = await page.goto(`${NOINDEX_URL}/`)
    await expect
        .poll(() => requested)
        .toEqual([
            'https://www.googletagmanager.com/gtm.js?id=GTM-E2ETEST',
        ])
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
        analytics_storage: 'denied',
        ad_storage: 'denied',
    })
    expect(response?.headers()['content-security-policy']).toContain('https://*.google-analytics.com')
})

test('without GTM_ID nothing loads and the CSP stays on this origin', async ({ page }) => {
    const requested = await stubContainer(page)
    const response = await page.goto('/')
    expect(requested).toEqual([])
    expect(await page.evaluate(() => 'dataLayer' in window)).toBe(false)
    expect(response?.headers()['content-security-policy']).not.toContain('google')
})
