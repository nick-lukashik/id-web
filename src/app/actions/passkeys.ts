'use server'

import {
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { type Route } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { ceremonyResponse, deviceName, passkeyError, type Result } from '@/lib/passkeys/passkeys'
import { safeContinue } from '@/lib/session/continue'
import { clientIp, requireSession } from '@/lib/session/current'
import { type SessionTokens } from '@/lib/session/session'
import { startSession } from '@/lib/session/start'

type Begun<Options> = {
    challengeId: string
    options: Options
}

/** A one-time challenge for a passkey sign-in (the button or the email field's autofill). */
export async function passkeySignInOptions(): Promise<Result<Begun<PublicKeyCredentialRequestOptionsJSON>>> {
    const result = await backend<Begun<PublicKeyCredentialRequestOptionsJSON>>('id', '/api/v1/login/passkey/options', {
        method: 'POST',
        clientIp: await clientIp(),
    })
    if (!result.ok || !result.data)
        return {
            ok: false,
            error: passkeyError(result),
        }
    return {
        ok: true,
        ...result.data,
    }
}

/**
 * The browser's answer to id-api. A verified passkey is an ordinary session:
 * the cookie is set here and the browser goes where it was going, an app's
 * /authorize included. Nothing comes back then; a refusal comes back.
 */
export async function passkeySignIn(challengeId: string, response: unknown, continueTo: string): Promise<Result> {
    const id = z.uuid().safeParse(challengeId)
    const answer = ceremonyResponse.safeParse(response)
    if (!id.success || !answer.success)
        return {
            ok: false,
            error: 'failed',
        }
    const result = await backend<SessionTokens>('id', '/api/v1/login/passkey/verify', {
        method: 'POST',
        body: {
            challengeId: id.data,
            response: answer.data,
        },
        clientIp: await clientIp(),
    })
    if (!result.ok || !result.data)
        return {
            ok: false,
            error: passkeyError(result),
        }
    await startSession(result.data)
    redirect(safeContinue(continueTo) as Route)
}

/** Creation options for a new passkey of the signed-in user. */
export async function passkeyRegisterOptions(): Promise<Result<Begun<PublicKeyCredentialCreationOptionsJSON>>> {
    const session = await requireSession()
    const result = await backend<Begun<PublicKeyCredentialCreationOptionsJSON>>('id', '/api/v1/me/passkeys/options', {
        method: 'POST',
        token: session.accessToken,
    })
    if (!result.ok || !result.data)
        return {
            ok: false,
            error: passkeyError(result),
        }
    return {
        ok: true,
        ...result.data,
    }
}

/** Saves the passkey the browser created, named after this browser. */
export async function passkeyRegister(challengeId: string, response: unknown): Promise<Result> {
    const session = await requireSession()
    const id = z.uuid().safeParse(challengeId)
    const answer = ceremonyResponse.safeParse(response)
    if (!id.success || !answer.success)
        return {
            ok: false,
            error: 'failed',
        }
    const result = await backend('id', '/api/v1/me/passkeys', {
        method: 'POST',
        token: session.accessToken,
        body: {
            challengeId: id.data,
            name: deviceName((await headers()).get('user-agent')),
            response: answer.data,
        },
    })
    if (!result.ok)
        return {
            ok: false,
            error: passkeyError(result),
        }
    return {
        ok: true,
    }
}

export async function removePasskey(form: FormData) {
    const session = await requireSession()
    const id = z.uuid().safeParse(form.get('passkeyId'))
    if (id.success)
        await backend('id', `/api/v1/me/passkeys/${id.data}`, {
            method: 'DELETE',
            token: session.accessToken,
        })
    redirect('/account')
}

export async function unlinkGoogle() {
    const session = await requireSession()
    const result = await backend('id', '/api/v1/me/identities/google', {
        method: 'DELETE',
        token: session.accessToken,
    })
    redirect(result.ok ? '/account?unlinked=google' : '/account?error=google_failed')
}
