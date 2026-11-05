import { randomUUID } from 'node:crypto'
import { en, expect, signIn, test } from './fixtures'
import { HTTPS_COOKIES_PORT } from './servers'

// The cookies as prod has them. With an https SITE_URL their names start with
// `__Secure-` or `__Host-`, and a browser ignores a Set-Cookie for such a name without
// Secure, also one that expires it: the cookie stays and the person stays signed in.
test.skip(Boolean(process.env.PW_BASE_URL), 'needs the server started by playwright.config.ts')
test.use({
    baseURL: `http://localhost:${HTTPS_COOKIES_PORT}`,
})

const SESSION = '__Secure-nl_session'
const LOGIN = '__Host-id_login'

test('sign-in drops the pending sign-in cookie', async ({ page, context }) => {
    await signIn(page)
    const names = (await context.cookies()).map(cookie => cookie.name)
    expect(names).toContain(SESSION)
    expect(names).not.toContain(LOGIN)
})

test('sign-out removes the session cookie and stays signed out', async ({ page, context }) => {
    await signIn(page)
    await page
        .getByRole('button', {
            name: en.nav.signOut,
        })
        .first()
        .click()
    await expect(page).toHaveURL(/\/login$/)
    expect((await context.cookies()).map(cookie => cookie.name)).not.toContain(SESSION)
    await page.reload()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)
})

test('another email on the code step drops the pending sign-in cookie', async ({ page, context }) => {
    await page.goto('/login?lang=en')
    await page.getByLabel(en.login.email).fill(`e2e-${randomUUID()}@example.com`)
    await page
        .getByRole('button', {
            name: en.login.send,
        })
        .click()
    await expect(page.getByLabel(en.login.code)).toBeVisible()
    expect((await context.cookies()).map(cookie => cookie.name)).toContain(LOGIN)
    await page
        .getByRole('button', {
            name: en.login.otherEmail,
        })
        .click()
    await expect(page.getByLabel(en.login.code)).toBeHidden()
    expect((await context.cookies()).map(cookie => cookie.name)).not.toContain(LOGIN)
})

test('a session cookie that does not open is removed', async ({ page, context }) => {
    await context.addCookies([
        {
            name: SESSION,
            value: 'not-a-sealed-session',
            domain: 'localhost',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax',
        },
    ])
    await page.goto('/login')
    expect((await context.cookies()).map(cookie => cookie.name)).not.toContain(SESSION)
})

test('a sign-out without a form body still signs out', async ({ page, context }) => {
    await signIn(page)
    const response = await page.request.post('/logout', {
        maxRedirects: 0,
    })
    expect(response.status()).toBeLessThan(400)
    expect((await context.cookies()).map(cookie => cookie.name)).not.toContain(SESSION)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)
})

test('a form on another site does not sign anyone out', async ({ page, context, baseURL }) => {
    await signIn(page)
    const other = await context.newPage()
    await other.setContent(`<form method="post" action="${baseURL}/logout"><button>Go</button></form>`)
    const [answer] = await Promise.all([
        other.waitForResponse(`${baseURL}/logout`),
        other.getByRole('button').click(),
    ])
    expect(answer.status()).toBe(403)
    expect((await context.cookies()).map(cookie => cookie.name)).toContain(SESSION)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/account$/)
})
