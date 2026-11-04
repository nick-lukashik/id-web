'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backWithError, refused } from '@/lib/backend/action-error'
import { backend } from '@/lib/backend/backend'
import { PAGE_SIZE, shownParam, withShown } from '@/lib/backend/list'
import { requireSession } from '@/lib/session/current'

/** The inbox as it was shown: the forms send its `show`, so a long list stays long. */
const inbox = (form: FormData) =>
    withShown('/notifications', shownParam(form.get('show'), PAGE_SIZE.notifications), PAGE_SIZE.notifications)

export async function markRead(form: FormData) {
    const session = await requireSession()
    const back = inbox(form)
    const id = z.uuid().safeParse(form.get('notificationId'))
    if (!id.success) backWithError(back, 'failed')
    const result = await backend('notifications', `/api/v1/me/notifications/${id.data}/read`, {
        method: 'POST',
        token: session.accessToken,
    })
    if (!result.ok) refused(result, back)
    redirect(back)
}

export async function markAllRead(form: FormData) {
    const session = await requireSession()
    const back = inbox(form)
    const result = await backend('notifications', '/api/v1/me/notifications/read-all', {
        method: 'POST',
        token: session.accessToken,
    })
    if (!result.ok) refused(result, back)
    redirect(back)
}
