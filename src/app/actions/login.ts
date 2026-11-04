'use server'

import { type Route } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { safeContinue } from '@/lib/session/continue'
import { clientIp, isHttps } from '@/lib/session/current'
import {
    cookieNames,
    cookieOptions,
    LOGIN_MAX_AGE,
    openLogin,
    type SessionTokens,
    sealLogin,
} from '@/lib/session/session'
import { startSession } from '@/lib/session/start'

const emailSchema = z.email().max(254)
const codeSchema = z.string().regex(/^[0-9]{6}$/)

/** The sign-in page again, with an error and the same destination. */
const back = (error: string, continueTo: string) =>
    `/login?error=${encodeURIComponent(error)}&continue=${encodeURIComponent(continueTo)}` as Route

/** Step 1: ask id-api for a code; the challenge waits in a sealed cookie for step 2. */
export async function startLogin(form: FormData) {
    const continueTo = safeContinue(form.get('continue'))
    const email = emailSchema.safeParse(String(form.get('email') ?? '').trim())
    if (!email.success) redirect(back('email', continueTo))
    const result = await backend<{
        challengeId: string
        expiresAt: string
    }>('id', '/api/v1/login/email', {
        method: 'POST',
        body: {
            email: email.data,
            locale: await getLocale(),
        },
        clientIp: await clientIp(),
    })
    if (!result.ok || !result.data) redirect(back(result.status === 429 ? 'rate_limited' : 'unavailable', continueTo))
    const https = isHttps()
    ;(await cookies()).set(
        cookieNames(https).login,
        sealLogin({
            challengeId: result.data.challengeId,
            email: email.data,
            expiresAt: Date.parse(result.data.expiresAt),
            continueTo,
        }),
        cookieOptions(https, LOGIN_MAX_AGE),
    )
    redirect(`/login?continue=${encodeURIComponent(continueTo)}` as Route)
}

/** Step 2: the code for a session; the tokens go into the sealed session cookie. */
export async function verifyLogin(form: FormData) {
    const https = isHttps()
    const jar = await cookies()
    const login = openLogin(jar.get(cookieNames(https).login)?.value)
    if (!login) redirect(back('expired', safeContinue(form.get('continue'))))
    const continueTo = safeContinue(login.continueTo)
    const code = codeSchema.safeParse(String(form.get('code') ?? '').replace(/\s/g, ''))
    if (!code.success) redirect(back('invalid_code', continueTo))
    const result = await backend<SessionTokens>('id', '/api/v1/login/email/verify', {
        method: 'POST',
        body: {
            challengeId: login.challengeId,
            code: code.data,
        },
        clientIp: await clientIp(),
    })
    if (!result.ok || !result.data) {
        const reason = result.error ?? 'unavailable'
        if (reason === 'expired' || reason === 'too_many_attempts') jar.delete(cookieNames(https).login)
        redirect(back(reason, continueTo))
    }
    await startSession(result.data)
    redirect(continueTo as Route)
}

/** Back to step 1 with another email. */
export async function restartLogin(form: FormData) {
    ;(await cookies()).delete(cookieNames(isHttps()).login)
    redirect(`/login?continue=${encodeURIComponent(safeContinue(form.get('continue')))}` as Route)
}
