'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { requireSession } from '@/lib/session/current'

export async function markRead(form: FormData) {
    const session = await requireSession()
    const id = z.uuid().safeParse(form.get('notificationId'))
    if (id.success)
        await backend('notifications', `/api/v1/me/notifications/${id.data}/read`, {
            method: 'POST',
            token: session.accessToken,
        })
    redirect('/notifications')
}

export async function markAllRead() {
    const session = await requireSession()
    await backend('notifications', '/api/v1/me/notifications/read-all', {
        method: 'POST',
        token: session.accessToken,
    })
    redirect('/notifications')
}
