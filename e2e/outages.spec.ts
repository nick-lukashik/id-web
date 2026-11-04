import { clearFaults, en, expect, fault, signIn, test } from './fixtures'

test.describe('sign-out while id-api cannot end the session', () => {
    test('says so and stays signed in; once it can, sign-out works', async ({ page, request }) => {
        const email = await signIn(page)
        await fault(request, email, 'POST', '/api/v1/sessions/logout', 503)
        await page
            .getByRole('banner')
            .getByRole('button', {
                name: en.nav.signOut,
            })
            .click()
        await expect(page).toHaveURL(/\/account\?error=unavailable$/)
        await expect(page.getByText(en.actionErrors.unavailable)).toBeVisible()
        await page.goto('/account')
        await expect(page).toHaveURL(/\/account$/)

        await clearFaults(request, email)
        await page
            .getByRole('banner')
            .getByRole('button', {
                name: en.nav.signOut,
            })
            .click()
        await expect(page).toHaveURL(/\/login$/)
    })

    test('a sign-out by link says so too', async ({ page, request }) => {
        const email = await signIn(page)
        await fault(request, email, 'POST', '/api/v1/sessions/logout', 503)
        await page.goto('/logout')
        await expect(page).toHaveURL(/\/account\?error=unavailable$/)
    })
})

test('a 401 on an expired token while id-api cannot refresh it is not the end of the session', async ({
    page,
    request,
}) => {
    const email = await signIn(page, 'expired-')
    await fault(request, email, 'POST', '/api/v1/sessions/refresh', 503)
    await fault(request, email, 'GET', '/api/v1/me', 401)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByText(en.account.unavailable)).toBeVisible()
})

test.describe('signing in again while signed in', () => {
    test('another email keeps it going', async ({ page }) => {
        await signIn(page)
        await page.goto('/login?reauth=1&lang=en')
        await page.getByLabel(en.login.email).fill('again@example.com')
        await page
            .getByRole('button', {
                name: en.login.send,
            })
            .click()
        await expect(page.getByLabel(en.login.code)).toBeVisible()
        await page
            .getByRole('button', {
                name: en.login.otherEmail,
            })
            .click()
        await expect(page.getByLabel(en.login.code)).toBeHidden()
        await expect(page).toHaveURL(/\/login\?.*reauth=1/)
        await expect(page.getByLabel(en.login.email)).toBeVisible()
    })

    test('a stale error in the address does not keep a signed-in person on the page', async ({ page }) => {
        await signIn(page)
        await page.goto('/login?error=invalid_code')
        await expect(page).toHaveURL(/\/account$/)
    })
})
