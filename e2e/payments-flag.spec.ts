import { randomUUID } from 'node:crypto'
import { type Locator } from '@playwright/test'
import { en, expect, NOINDEX_URL, signIn, test } from './fixtures'
import { SITE_PORT } from './servers'

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

    test('the payment actions are not found either', async ({ page, browser }) => {
        /** The field that names a form's Server Action; the build is the same, so its id works on both sites. */
        const actionField = async (form: Locator) => {
            const name = await form.locator('input[name^="$ACTION_ID_"]').getAttribute('name')
            expect(name).toBeTruthy()
            return name ?? ''
        }
        // The site with the flag on shows the forms.
        const enabled = await browser.newContext({
            baseURL: `http://localhost:${SITE_PORT}`,
        })
        const shop = await enabled.newPage()
        await signIn(shop)
        await shop.goto('/wallet?currency=USD')
        const pack = shop.getByRole('listitem').filter({
            hasText: '100 coins',
        })
        const checkout = await actionField(pack)
        await pack
            .getByRole('button', {
                name: en.wallet.buy,
            })
            .click()
        await expect(shop).toHaveURL(/\/payments\/fake\/[\w-]+$/)
        // Only a page rendered on the server has that field.
        await shop.reload()
        const pay = await actionField(shop.getByRole('main'))
        const paymentId = new URL(shop.url()).pathname.split('/').pop() ?? ''
        await enabled.close()

        await signIn(page)
        const started = await page.request.post('/wallet', {
            multipart: {
                [checkout]: '',
                productKey: 'coins-100',
                currency: 'USD',
                idempotencyKey: randomUUID(),
            },
            maxRedirects: 0,
        })
        expect(started.status()).toBe(404)
        // Still signed in: only the payment actions answered.
        await page.goto('/wallet')
        await expect(page).toHaveURL(/\/wallet$/)
        const completed = await page.request.post(`/payments/fake/${paymentId}`, {
            multipart: {
                [pay]: '',
                paymentId,
            },
            maxRedirects: 0,
        })
        expect(completed.status()).toBe(404)
    })
})
