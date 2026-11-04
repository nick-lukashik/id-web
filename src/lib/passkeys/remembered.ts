import 'server-only'
import { cookies } from 'next/headers'
import { backend } from '@/lib/backend/backend'
import { serverEnv } from '@/lib/env/server'
import { isHttps } from '@/lib/session/current'
import { seal, unseal } from '@/lib/session/seal'
import { cookieNames, cookieOptions, expiredCookie } from '@/lib/session/session'
import { type PasskeyItem } from './passkeys'

/**
 * The passkey last used or added in this browser, which the sign-in page offers
 * by name. A page cannot ask the browser whether it holds a passkey without
 * starting a request, so this cookie stands in. It outlives sign-out, which is
 * when it is needed. It names a device ("Chrome on macOS"), not a person, and
 * opens nothing: a press still needs the passkey.
 */
export type RememberedPasskey = {
    id: string
    name: string
}

const MAX_AGE = 60 * 60 * 24 * 365
const PURPOSE = 'passkey'

export async function rememberedPasskey() {
    const sealed = (await cookies()).get(cookieNames(isHttps()).passkey)?.value
    return unseal<RememberedPasskey>(sealed, serverEnv.SESSION_SECRET, PURPOSE)
}

export async function rememberPasskey({ id, name }: RememberedPasskey) {
    const https = isHttps()
    const sealed = seal(
        {
            id,
            name,
        },
        serverEnv.SESSION_SECRET,
        PURPOSE,
    )
    ;(await cookies()).set(cookieNames(https).passkey, sealed, cookieOptions(https, MAX_AGE))
}

/** The passkey that just signed in, by its credential. Quietly: without it the page offers the plain button. */
export async function rememberUsedPasskey(accessToken: string, credentialId: string) {
    const passkeys = await backend<{
        items: PasskeyItem[]
    }>('id', '/api/v1/me/passkeys', {
        token: accessToken,
    })
    const used = passkeys.data?.items.find(item => item.credentialId === credentialId)
    if (used) await rememberPasskey(used)
}

export async function forgetPasskey() {
    const https = isHttps()
    ;(await cookies()).set(cookieNames(https).passkey, '', expiredCookie(https))
}
