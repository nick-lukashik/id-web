import { en, expect, test } from './fixtures'

test('the sign-in page names the terms and the policy, as an account is created there', async ({ page }) => {
    await page.goto('/login?lang=en')
    const main = page.getByRole('main')
    await expect(
        main.getByRole('link', {
            name: 'terms of service',
        }),
    ).toHaveAttribute('href', 'https://nick-lukashik.com/terms')
    await expect(
        main.getByRole('link', {
            name: 'privacy policy',
        }),
    ).toHaveAttribute('href', 'https://nick-lukashik.com/privacy')
})

test('the footer links both on every page', async ({ page }) => {
    await page.goto('/nowhere?lang=en')
    const footer = page.getByRole('contentinfo')
    await expect(
        footer.getByRole('link', {
            name: en.footer.terms,
        }),
    ).toHaveAttribute('href', 'https://nick-lukashik.com/terms')
    await expect(
        footer.getByRole('link', {
            name: en.footer.privacy,
        }),
    ).toHaveAttribute('href', 'https://nick-lukashik.com/privacy')
})
