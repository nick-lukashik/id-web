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
const answer = (page: Page, name: string) =>
    expect(async () => {
        await banner(page)
            .getByRole('button', {
                name,
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

    test('nothing loads until the person agrees; then it does, on this page and the next', async ({ page }) => {
        const requested = await stubContainer(page)
        const response = await page.goto(`${NOINDEX_URL}/`)
        await expect(banner(page)).toBeVisible()
        expect(requested).toEqual([])
        expect(await hasLayer(page)).toBe(false)
        expect(response?.headers()['content-security-policy']).toContain('https://*.google-analytics.com')

        await answer(page, en.consent.accept)
        await expect
            .poll(() => requested)
            .toEqual([
                CONTAINER,
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
            analytics_storage: 'granted',
            ad_storage: 'denied',
        })
        await expect
            .poll(() => consentCookie(page))
            .toMatchObject({
                value: 'granted',
                httpOnly: true,
            })

        await page.reload()
        await expect
            .poll(() => requested)
            .toEqual([
                CONTAINER,
                CONTAINER,
            ])
        await expect(banner(page)).toBeHidden()
    })

    test('declined: nothing loads, now or on the next page, and it is not asked again', async ({ page }) => {
        const requested = await stubContainer(page)
        await page.goto(`${NOINDEX_URL}/`)
        await answer(page, en.consent.decline)
        await expect
            .poll(() => consentCookie(page))
            .toMatchObject({
                value: 'denied',
            })

        await page.reload()
        await expect(banner(page)).toBeHidden()
        await expect(
            page.getByRole('button', {
                name: en.consent.settings,
            }),
        ).toBeVisible()
        expect(requested).toEqual([])
        expect(await hasLayer(page)).toBe(false)
    })

    test("the footer's button brings the banner back: a no drops Google's cookies, a yes starts it", async ({
        page,
        context,
    }) => {
        const requested = await stubContainer(page)
        await page.goto(`${NOINDEX_URL}/`)
        await answer(page, en.consent.accept)
        await expect.poll(() => requested).toHaveLength(1)
        await expect
            .poll(() => consentCookie(page))
            .toMatchObject({
                value: 'granted',
            })
        await context.addCookies(
            [
                '_ga',
                '_ga_ABC',
            ].map(name => ({
                name,
                value: '1',
                url: NOINDEX_URL as string,
            })),
        )
        const settings = page.getByRole('button', {
            name: en.consent.settings,
        })
        await settings.click()
        await answer(page, en.consent.decline)
        await expect
            .poll(() => consentCookie(page))
            .toMatchObject({
                value: 'denied',
            })
        await expect
            .poll(async () =>
                (await context.cookies()).map(cookie => cookie.name).filter(name => name.startsWith('_ga')),
            )
            .toEqual([])

        await page.reload()
        await settings.click()
        await answer(page, en.consent.accept)
        await expect.poll(() => requested).toHaveLength(2)
    })
})

test('without GTM_ID there is no banner, nothing loads and the CSP stays on this origin', async ({ page }) => {
    const requested = await stubContainer(page)
    const response = await page.goto('/')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(banner(page)).toHaveCount(0)
    await expect(
        page.getByRole('button', {
            name: en.consent.settings,
        }),
    ).toHaveCount(0)
    expect(requested).toEqual([])
    expect(await hasLayer(page)).toBe(false)
    expect(response?.headers()['content-security-policy']).not.toContain('google')
})
