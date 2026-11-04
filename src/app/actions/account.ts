'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { requireSession } from '@/lib/session/current'
import { endSession } from '@/lib/session/start'

/** Signs out here and on every site signed in from this session. */
export async function signOut() {
    await endSession()
    redirect('/login')
}

export async function updateProfile(form: FormData) {
    const session = await requireSession()
    const input = z
        .object({
            displayName: z.string().trim().max(80),
            locale: z.enum([
                'en',
                'ru',
            ]),
        })
        .safeParse({
            displayName: form.get('displayName') ?? '',
            locale: form.get('locale'),
        })
    if (!input.success) redirect('/account?error=profile')
    const result = await backend('id', '/api/v1/me', {
        method: 'PATCH',
        token: session.accessToken,
        body: {
            displayName: input.data.displayName === '' ? null : input.data.displayName,
            locale: input.data.locale,
        },
    })
    redirect(result.ok ? '/account?saved=1' : '/account?error=profile')
}

export async function revokeSession(form: FormData) {
    const session = await requireSession()
    const id = z.uuid().safeParse(form.get('sessionId'))
    if (id.success)
        await backend('id', `/api/v1/me/sessions/${id.data}`, {
            method: 'DELETE',
            token: session.accessToken,
        })
    redirect('/account')
}

export async function revokeOtherSessions() {
    const session = await requireSession()
    await backend('id', '/api/v1/me/sessions/revoke-others', {
        method: 'POST',
        token: session.accessToken,
    })
    redirect('/account')
}
