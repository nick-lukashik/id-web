import AxeBuilder from '@axe-core/playwright'
import { en, expect, signIn, test } from './fixtures'

test('the header is one row: mark, sections, language and sign-out', async ({ page }) => {
    await page.setViewportSize({
        width: 1288,
        height: 800,
    })
    await signIn(page)
    const header = page.getByRole('banner')
    const height = await header.evaluate(element => element.getBoundingClientRect().height)
    expect(height).toBeLessThan(70)
    await expect(
        header.getByRole('link', {
            name: en.nav.wallet,
        }),
    ).toBeVisible()
    await expect(
        header.getByRole('button', {
            name: en.nav.signOut,
        }),
    ).toBeVisible()
})

test('on a phone the sections and sign-out are in the menu', async ({ page }) => {
    await page.setViewportSize({
        width: 390,
        height: 844,
    })
    await signIn(page)
    const header = page.getByRole('banner')
    await expect(
        header.getByRole('link', {
            name: en.nav.wallet,
        }),
    ).toBeHidden()
    await header.getByText(en.nav.menu).click()
    await expect(
        header.getByRole('button', {
            name: en.nav.signOut,
        }),
    ).toBeVisible()
    const results = await new AxeBuilder({
        page,
    })
        .withTags([
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
        ])
        .analyze()
    expect(results.violations).toEqual([])
    await header
        .getByRole('link', {
            name: en.nav.wallet,
        })
        .click()
    await expect(page).toHaveURL(/\/wallet$/)
    // A new page starts with the menu closed.
    await expect(
        header.getByRole('button', {
            name: en.nav.signOut,
        }),
    ).toBeHidden()
})
