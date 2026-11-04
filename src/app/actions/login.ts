'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { clientIp, isHttps } from '@/lib/session/current'
import {
    cookieNames,
    cookieOptions,
    LOGIN_MAX_AGE,
    openLogin,
    SESSION_MAX_AGE,
    sealLogin,
    sealSession,
    sessionFromTokens,
} from '@/lib/session/session'

const emailSchema = z.email().max(254)
const codeSchema = z.string().regex(/^[0-9]{6}$/)

/** Step 1: ask id-api for a code; the challenge waits in a sealed cookie for step 2. */
export async function startLogin(form: FormData) {
    const email = emailSchema.safeParse(String(form.get('email') ?? '').trim())
    if (!email.success) redirect('/login?error=email')
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
    if (!result.ok || !result.data) redirect(`/login?error=${result.status === 429 ? 'rate_limited' : 'unavailable'}`)
    const https = isHttps()
    ;(await cookies()).set(
        cookieNames(https).login,
        sealLogin({
            challengeId: result.data.challengeId,
            email: email.data,
            expiresAt: Date.parse(result.data.expiresAt),
        }),
        cookieOptions(https, LOGIN_MAX_AGE),
    )
    redirect('/login')
}

/** Step 2: the code for a session; the tokens go into the sealed session cookie. */
export async function verifyLogin(form: FormData) {
    const https = isHttps()
    const jar = await cookies()
    const login = openLogin(jar.get(cookieNames(https).login)?.value)
    if (!login) redirect('/login?error=expired')
    const code = codeSchema.safeParse(String(form.get('code') ?? '').replace(/\s/g, ''))
    if (!code.success) redirect('/login?error=invalid_code')
    const result = await backend<{
        accessToken: string
        accessExpiresAt: string
        refreshToken: string
        sessionId: string
    }>('id', '/api/v1/login/email/verify', {
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
        redirect(`/login?error=${encodeURIComponent(reason)}`)
    }
    jar.set(
        cookieNames(https).session,
        sealSession(sessionFromTokens(result.data)),
        cookieOptions(https, SESSION_MAX_AGE),
    )
    jar.delete(cookieNames(https).login)
    redirect('/account')
}

/** Back to step 1 with another email. */
export async function restartLogin() {
    ;(await cookies()).delete(cookieNames(isHttps()).login)
    redirect('/login')
}
