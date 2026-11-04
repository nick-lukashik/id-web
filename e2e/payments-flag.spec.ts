import { randomUUID } from 'node:crypto'
import { en, expect, NOINDEX_URL, signIn, test } from './fixtures'

const external = Boolean(process.env.PW_BASE_URL)

test.describe('PAYMENTS_ENABLED=true (the site of playwright.config.ts)', () => {
    test('the header links to the payments and the wallet sells coin packs', async ({ page }) => {
        await signIn(page)
        await expect(
            page.getByRole('banner').getByRole('link', {
                name: en.nav.payments,
            }),
        ).toBeVisible()
        await page.goto('/wallet')
        await expect(
            page.getByRole('heading', {
                name: en.wallet.topUp,
            }),
        ).toBeVisible()
    })
})

test.describe('PAYMENTS_ENABLED unset: no payments while pay-api is not deployed', () => {
    // The second site of playwright.config.ts leaves the flag at its default.
    test.skip(external || !NOINDEX_URL, 'needs the sites playwright.config.ts starts')
    test.use({
        baseURL: NOINDEX_URL,
    })

    test('no payments link, no top-up, and the payment pages are not found', async ({ page }) => {
        await signIn(page)
        const header = page.getByRole('banner')
        await expect(
            header.getByRole('link', {
                name: en.nav.wallet,
            }),
        ).toBeVisible()
        await expect(
            header.getByRole('link', {
                name: en.nav.payments,
            }),
        ).toHaveCount(0)

        await page.goto('/wallet')
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: en.wallet.heading,
            }),
        ).toBeVisible()
        await expect(
            page.getByRole('heading', {
                name: en.wallet.topUp,
            }),
        ).toHaveCount(0)
        await expect(
            page.getByRole('button', {
                name: en.wallet.buy,
            }),
        ).toHaveCount(0)

        for (const path of [
            '/payments',
            `/payments/fake/${randomUUID()}`,
        ]) {
            const response = await page.goto(path)
            expect(response?.status()).toBe(404)
            await expect(page).toHaveTitle(`${en.notFound.title} · ${en.meta.siteName}`)
            await expect(
                page.getByRole('heading', {
                    level: 1,
                    name: en.notFound.title,
                }),
            ).toBeVisible()
        }
    })
})
