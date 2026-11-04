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
        document.addEventListener(
            'click',
            () => {
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
    await page.evaluate(() => {
        ;(window as Recorded).autofillRequests = 0
    })
    await signOut(page)
    await expect.poll(() => page.evaluate(() => (window as Recorded).autofillRequests ?? 0)).toBeGreaterThan(0)
    await present(true)
}

const press = (page: Page) =>
    page
        .getByRole('button', {
            name: en.passkeys.signIn,
        })
        .click()

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
    let failed = false
    await page.route('**/login', async route => {
        if (route.request().method() === 'POST' && !failed) {
            failed = true
            return route.abort()
        }
        return route.fallback()
    })
    await signOut(page)
    await expect.poll(() => failed).toBe(true)
    await present(true)
    await press(page)
    await expect(page).toHaveURL(/\/account$/)
})
