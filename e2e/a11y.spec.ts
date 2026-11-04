import AxeBuilder from '@axe-core/playwright'
import { expect, signIn, test } from './fixtures'

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
})
