'use server'

import { type Route } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { type BackendResult, backend } from '@/lib/backend/backend'
import { safeContinue } from '@/lib/session/continue'
import { clientIp, isHttps } from '@/lib/session/current'
import {
    cookieNames,
    cookieOptions,
    LOGIN_MAX_AGE,
    openLogin,
    type PendingLogin,
    type SessionTokens,
    sealLogin,
} from '@/lib/session/session'
import { startSession } from '@/lib/session/start'

const emailSchema = z.email().max(254)
const codeSchema = z.string().regex(/^[0-9]{6}$/)

/** The sign-in page again, with an error and the same destination; `wait` is in seconds. */
const back = (error: string, continueTo: string, wait?: number) =>
    `/login?error=${encodeURIComponent(error)}${wait ? `&wait=${wait}` : ''}&continue=${encodeURIComponent(continueTo)}` as Route

/** id-api's answer to a code request. */
type CodeRequest = {
    challengeId: string
    expiresAt: string
    resendAfter: string
    /** `failed`: the mail service did not take the code, so none is on its way. */
    deliveryStatus: 'accepted' | 'failed'
}

async function requestCode(email: string) {
    return backend<CodeRequest>('id', '/api/v1/login/email', {
        method: 'POST',
        body: {
            email,
            locale: await getLocale(),
        },
        clientIp: await clientIp(),
    })
}

/**
 * Where a refused code request goes. id-api's limiter puts the wait (ms) in
 * the first detail of its 429, which `backend()` returns as `error`; other
 * 429s name none.
 */
function refused(result: BackendResult<unknown>, continueTo: string) {
    if (result.status !== 429) return back('unavailable', continueTo)
    const wait = Math.ceil(Number(result.error) / 1000)
    return back('rate_limited', continueTo, Number.isFinite(wait) && wait > 0 ? wait : undefined)
}

async function keepLogin(login: PendingLogin) {
    const https = isHttps()
    ;(await cookies()).set(cookieNames(https).login, sealLogin(login), cookieOptions(https, LOGIN_MAX_AGE))
}

/** Step 1: ask id-api for a code; the challenge waits in a sealed cookie for step 2. */
export async function startLogin(form: FormData) {
    const continueTo = safeContinue(form.get('continue'))
    const email = emailSchema.safeParse(String(form.get('email') ?? '').trim())
    if (!email.success) redirect(back('email', continueTo))
    const result = await requestCode(email.data)
    if (!result.ok || !result.data) redirect(refused(result, continueTo))
    // No code is coming: stay on step 1 rather than wait for it on step 2.
    if (result.data.deliveryStatus === 'failed') redirect(back('delivery_failed', continueTo))
    await keepLogin({
        challengeId: result.data.challengeId,
        email: email.data,
        expiresAt: Date.parse(result.data.expiresAt),
        resendAfter: Date.parse(result.data.resendAfter),
        continueTo,
    })
    redirect(`/login?continue=${encodeURIComponent(continueTo)}` as Route)
}

/** Step 2 again: a new code for the same email after id-api's cooldown; it replaces the challenge. */
export async function resendLogin(form: FormData) {
    const login = openLogin((await cookies()).get(cookieNames(isHttps()).login)?.value)
    if (!login) redirect(back('expired', safeContinue(form.get('continue'))))
    const continueTo = safeContinue(login.continueTo)
    const result = await requestCode(login.email)
    if (!result.ok || !result.data) redirect(refused(result, continueTo))
    const resendAfter = Date.parse(result.data.resendAfter)
    // Not sent: the last code still works, and the cooldown has started again.
    if (result.data.deliveryStatus === 'failed') {
        await keepLogin({
            ...login,
            resendAfter,
        })
        redirect(back('delivery_failed', continueTo))
    }
    await keepLogin({
        ...login,
        challengeId: result.data.challengeId,
        expiresAt: Date.parse(result.data.expiresAt),
        resendAfter,
    })
    redirect(`/login?resent=1&continue=${encodeURIComponent(continueTo)}` as Route)
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
