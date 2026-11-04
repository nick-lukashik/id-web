import { en, expect, ru, test } from './fixtures'

test.describe('language', () => {
    test('?lang=ru renders Russian and rewrites the cookie', async ({ page, context }) => {
        await page.goto('/login?lang=ru')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page).toHaveTitle(`${ru.login.title} · ${ru.meta.siteName}`)
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: ru.login.heading,
            }),
        ).toBeVisible()

        const cookies = await context.cookies()
        expect(cookies.find(cookie => cookie.name === 'locale')?.value).toBe('ru')

        // Without the parameter the cookie keeps the choice.
        await page.goto('/login')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

        // And ?lang=en switches back.
        await page.goto('/login?lang=en')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await page.goto('/login')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })

    test('the language switch keeps the page and sets only the cookie', async ({ page, context }) => {
        await page.goto('/login?lang=en')
        await page
            .getByRole('navigation', {
                name: en.nav.language,
            })
            .getByRole('link', {
                name: ru.meta.languageName,
            })
            .click()
        // Only the cookie changes: the address gets no ?lang=.
        await expect(page).toHaveURL(/\/login$/)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: ru.login.heading,
            }),
        ).toBeVisible()
        const cookies = await context.cookies()
        expect(cookies.find(cookie => cookie.name === 'locale')?.value).toBe('ru')
    })
})

test.describe('without JavaScript', () => {
    test.use({
        javaScriptEnabled: false,
    })

    test('the language switch falls back to ?lang=', async ({ page }) => {
        await page.goto('/login?lang=en')
        await page
            .getByRole('navigation', {
                name: en.nav.language,
            })
            .getByRole('link', {
                name: ru.meta.languageName,
            })
            .click()
        await expect(page).toHaveURL(/\/login\?lang=ru$/)
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    })
})

test.describe('first visit with a Russian browser', () => {
    test.use({
        locale: 'ru-RU',
    })

    test('falls back to Accept-Language', async ({ page }) => {
        await page.goto('/login')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page).toHaveTitle(`${ru.login.title} · ${ru.meta.siteName}`)
    })
})
