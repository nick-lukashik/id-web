import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { en, expect, fault, seed, signIn, test } from './fixtures'

const WCAG = [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
]

test.describe('accessibility', () => {
    test('the toast has no axe violations', async ({ page }) => {
        await signIn(page)
        await page
            .getByRole('button', {
                name: en.account.revokeOthers,
            })
            .click()
        await expect(
            page
                .getByRole('region', {
                    name: en.toast.region,
                })
                .getByText('No other devices are signed in.'),
        ).toBeVisible()
        // Settled: axe reads a colour mixed with the page while the toast fades in.
        await expect(page.locator('[data-sonner-toast]')).toHaveCSS('opacity', '1')
        const results = await new AxeBuilder({
            page,
        })
            .withTags(WCAG)
            .analyze()
        expect(results.violations).toEqual([])
    })

    for (const { path, signedIn } of [
        {
            path: '/login',
            signedIn: false,
        },
        {
            path: '/nowhere',
            signedIn: false,
        },
        {
            path: '/account',
            signedIn: true,
        },
        {
            path: '/wallet',
            signedIn: true,
        },
        {
            path: '/payments',
            signedIn: true,
        },
        {
            path: '/notifications',
            signedIn: true,
        },
    ]) {
        test(`${path} has no axe violations`, async ({ page }) => {
            if (signedIn) await signIn(page)
            await page.goto(path)
            await page.locator('main').waitFor()
            const results = await new AxeBuilder({
                page,
            })
                .withTags(WCAG)
                .analyze()
            expect(results.violations).toEqual([])
        })
    }

    test('step 2 of /login has no axe violations', async ({ page }) => {
        await page.goto('/login?lang=en')
        await page.getByLabel(en.login.email).fill(`e2e-${randomUUID()}@example.com`)
        await page
            .getByRole('button', {
                name: en.login.send,
            })
            .click()
        await expect(page.getByLabel(en.login.code)).toBeVisible()
        // A soft navigation: the title of the page settles a moment after its content.
        await expect(page).toHaveTitle(`${en.login.title} · ${en.meta.siteName}`)
        const results = await new AxeBuilder({
            page,
        })
            .withTags(WCAG)
            .analyze()
        expect(results.violations).toEqual([])
    })

    test('"Show more" and a part that did not load have no axe violations', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            payments: 21,
            sessions: 51,
        })
        await fault(request, email, 'GET', '^/api/v1/me/wallet/history$', 503)
        for (const { path, shows } of [
            {
                path: '/payments',
                shows: en.states.more,
            },
            {
                path: '/account',
                shows: en.states.more,
            },
            {
                path: '/wallet',
                shows: en.wallet.historyUnavailable,
            },
        ]) {
            await page.goto(path)
            await expect(page.getByText(shows)).toBeVisible()
            const results = await new AxeBuilder({
                page,
            })
                .withTags(WCAG)
                .analyze()
            expect(results.violations).toEqual([])
        }
    })
})
