import { type Page } from '@playwright/test'
import { en, expect, signIn, test } from './fixtures'

// Safari wants the passkey request made inside the click, and refuses one while
// the autofill's request waits. WebKit has no virtual authenticator here, so
// these check in Chromium what the code does: where the request starts, that a
// refusal is told, and that a second press goes through.

type Recorded = Window & {
    autofillRequests?: number
    refuseNext?: {
        name: string
        afterMs: number
    }
}

/** Where the button's request started goes to sessionStorage: it survives the navigation after a sign-in. */
const recordRequests = (page: Page) =>
    page.addInitScript(() => {
        const recorded = window as Recorded
        let inClick = false
        let autofillSignal: AbortSignal | null | undefined
        document.addEventListener(
            'click',
            () => {
                sessionStorage.setItem('autofillGoneAtClick', String(autofillSignal?.aborted))
                inClick = true
                setTimeout(() => {
                    inClick = false
                }, 0)
            },
            true,
        )
        const get = navigator.credentials.get.bind(navigator.credentials)
        navigator.credentials.get = options => {
            if (options?.mediation === 'conditional') {
                recorded.autofillRequests = (recorded.autofillRequests ?? 0) + 1
                autofillSignal = options.signal
                return get(options)
            }
            sessionStorage.setItem('requestInClick', String(inClick))
            const refusal = recorded.refuseNext
            if (!refusal) return get(options)
            recorded.refuseNext = undefined
            return new Promise((_, reject) => {
                setTimeout(() => reject(new DOMException('refused', refusal.name)), refusal.afterMs)
            })
        }
    })

/** A user with a passkey on this device. Returns the switch of the person's presence at it. */
async function withAPasskey(page: Page) {
    await recordRequests(page)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    })
    await signIn(page)
    await page
        .getByRole('button', {
            name: en.passkeys.add,
        })
        .click()
    await expect(page.getByText(en.passkeys.added)).toBeVisible()
    return (enabled: boolean) =>
        cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
            authenticatorId,
            enabled,
        })
}

async function signOut(page: Page) {
    await page
        .getByRole('banner')
        .getByRole('button', {
            name: en.nav.signOut,
        })
        .click()
    await expect(page).toHaveURL(/\/login$/)
}

/** Signed out, with the autofill's request waiting and the device ready to answer the next one. */
async function atSignIn(page: Page) {
    const present = await withAPasskey(page)
    await present(false)
    await countAutofillAfresh(page)
    await signOut(page)
    await autofillWaits(page)
    await present(true)
}

const countAutofillAfresh = (page: Page) =>
    page.evaluate(() => {
        ;(window as Recorded).autofillRequests = 0
    })

const autofillWaits = (page: Page) =>
    expect.poll(() => page.evaluate(() => (window as Recorded).autofillRequests ?? 0)).toBeGreaterThan(0)

/** Answers the `failing`-th server action from now with a network failure, and lets the others through. */
async function failServerAction(page: Page, failing = 1) {
    let seen = 0
    const state = {
        failed: false,
    }
    await page.route('**/login', async route => {
        if (route.request().method() === 'POST') {
            seen += 1
            if (seen === failing) {
                state.failed = true
                return route.abort()
            }
        }
        return route.fallback()
    })
    return state
}

async function removeThePasskey(page: Page) {
    await page
        .getByRole('button', {
            name: en.account.removePasskey,
        })
        .click()
    await expect(
        page.getByRole('button', {
            name: en.account.removePasskey,
        }),
    ).toBeHidden()
}

/** What a page must never do: throw into the error page or leave a promise unhandled. */
function pageErrors(page: Page) {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    return errors
}

/** The button by either of its names: this browser's passkey, or any passkey. */
const passkeyButton = (page: Page) =>
    page.getByRole('button', {
        name: /^Sign in with .*passkey/,
    })

const press = (page: Page) => passkeyButton(page).click()

/** The name the mock gives a passkey added in this browser. */
const NAMED = /^Sign in with passkey “Chrome on .+”$/

const REMEMBERED_COOKIE = 'id_passkey'

const refuseNext = (page: Page, name: string, afterMs: number) =>
    page.evaluate(
        refusal => {
            ;(window as Recorded).refuseNext = refusal
        },
        {
            name,
            afterMs,
        },
    )

const requestInClick = (page: Page) => page.evaluate(() => sessionStorage.getItem('requestInClick'))

test('the button asks for the passkey inside the click', async ({ page }) => {
    await atSignIn(page)
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
    expect(await requestInClick(page)).toBe('true')
    // The autofill's request was already gone: Safari refuses a new one while it waits.
    expect(await page.evaluate(() => sessionStorage.getItem('autofillGoneAtClick'))).toBe('true')
})

for (const name of [
    'NotAllowedError',
    'AbortError',
]) {
    test(`a refusal at once (${name}) is told, and a second press goes through`, async ({ page }) => {
        await atSignIn(page)
        await refuseNext(page, name, 0)
        await press(page)
        await expect(page.getByText(en.passkeys.errors.not_opened)).toBeVisible()
        await press(page)
        await expect(page).toHaveURL(/\/account$/)
        expect(await requestInClick(page)).toBe('true')
    })
}

test('a person who cancels is told that, not that it did not open', async ({ page }) => {
    await atSignIn(page)
    await refuseNext(page, 'NotAllowedError', 1_000)
    await press(page)
    await expect(page.getByText(en.passkeys.errors.cancelled)).toBeVisible()
    await expect(page.getByText(en.passkeys.errors.not_opened)).toBeHidden()
})

test('with no challenge ready the button fetches one and still signs in', async ({ page }) => {
    const present = await withAPasskey(page)
    await present(false)
    // The page's first request for a challenge fails: nothing is ready when the button is pressed.
    const options = await failServerAction(page)
    await signOut(page)
    await expect.poll(() => options.failed).toBe(true)
    await present(true)
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
    expect(await requestInClick(page)).toBe('false')
})

test('an answer that never reached the server is told, and the next press works', async ({ page }) => {
    const errors = pageErrors(page)
    await atSignIn(page)
    await failServerAction(page)
    await press(page)
    await expect(page.getByText(en.passkeys.errors.unavailable)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await page.unrouteAll()
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
    expect(errors).toEqual([])
})

test('the autofill survives an answer that never reached the server', async ({ page }) => {
    const errors = pageErrors(page)
    await withAPasskey(page)
    // The device stays present, so the autofill answers at once: first the challenge, then the answer, which fails.
    await failServerAction(page, 2)
    await signOut(page)
    await expect(page).toHaveURL(/\/account$/)
    expect(errors).toEqual([])
})

test('a failed request for a challenge is tried again', async ({ page }) => {
    await page.clock.install()
    const present = await withAPasskey(page)
    await present(false)
    await countAutofillAfresh(page)
    const options = await failServerAction(page)
    await signOut(page)
    await expect.poll(() => options.failed).toBe(true)
    await page.clock.fastForward(31_000)
    await autofillWaits(page)
})

test('a press without a click: the autofill comes back by itself', async ({ page }) => {
    await page.clock.install()
    await atSignIn(page)
    await passkeyButton(page).hover()
    await page.mouse.down()
    await page.mouse.move(0, 0)
    await page.mouse.up()
    await countAutofillAfresh(page)
    await page.clock.fastForward(16_000)
    await autofillWaits(page)
})

test('a challenge that expired while the tab slept is replaced when it wakes', async ({ page }) => {
    await page.clock.install()
    await atSignIn(page)
    await countAutofillAfresh(page)
    // Only the date moves: timers of a frozen tab do not fire.
    await page.clock.setSystemTime(new Date(Date.now() + 10 * 60_000))
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await autofillWaits(page)
})

test('the passkey of this browser is offered by name and first, after sign-out too', async ({ page }) => {
    await atSignIn(page)
    await expect(passkeyButton(page)).toHaveText(NAMED)
    const button = await passkeyButton(page).boundingBox()
    const field = await page.getByLabel(en.login.email).boundingBox()
    expect(button?.y).toBeLessThan(field?.y ?? 0)
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
})

test('without a remembered passkey the plain button comes after the form, and a sign-in remembers it', async ({
    page,
    context,
}) => {
    const present = await withAPasskey(page)
    await present(false)
    await signOut(page)
    await context.clearCookies({
        name: REMEMBERED_COOKIE,
    })
    await page.reload()
    await autofillWaits(page)
    await expect(passkeyButton(page)).toHaveText(en.passkeys.signIn)
    const button = await passkeyButton(page).boundingBox()
    const field = await page.getByLabel(en.login.email).boundingBox()
    expect(button?.y).toBeGreaterThan(field?.y ?? 0)
    await present(true)
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
    await present(false)
    await signOut(page)
    await expect(passkeyButton(page)).toHaveText(NAMED)
})

test('a removed passkey is no longer offered', async ({ page }) => {
    const present = await withAPasskey(page)
    await present(false)
    await removeThePasskey(page)
    await signOut(page)
    await expect(passkeyButton(page)).toHaveText(en.passkeys.signIn)
})

test('a passkey removed elsewhere is told once, and no longer offered', async ({ page, context }) => {
    const present = await withAPasskey(page)
    await present(false)
    const remembered = (await context.cookies()).find(cookie => cookie.name === REMEMBERED_COOKIE)
    await removeThePasskey(page)
    await signOut(page)
    if (!remembered) throw new Error('nothing remembered')
    await context.addCookies([
        remembered,
    ])
    await page.reload()
    await autofillWaits(page)
    await expect(passkeyButton(page)).toHaveText(NAMED)
    await present(true)
    await press(page)
    // The cookie goes in the same answer: the button moves down and still says why.
    await expect(passkeyButton(page)).toHaveText(en.passkeys.signIn)
    await expect(page.getByText(en.passkeys.errors.unknown)).toBeVisible()
})
