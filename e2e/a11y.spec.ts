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

    test('"Show more" and a part that did not load have no axe violations', async ({ page, request }) => {
        const email = await signIn(page)
        await seed(request, email, {
            payments: 21,
        })
        await fault(request, email, 'GET', '^/api/v1/me/wallet/history$', 503)
        for (const { path, shows } of [
            {
                path: '/payments',
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
