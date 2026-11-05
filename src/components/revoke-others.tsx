'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useEffectEvent } from 'react'
import { toast } from 'sonner'
import { revokeOtherSessions } from '@/app/actions/account'
import { Button } from '@/components/ui/button'

/**
 * "Sign out everywhere else". With nothing to end the list looks the same
 * afterwards and the button would seem broken, so a toast says what it did.
 */
export function RevokeOthers() {
    const t = useTranslations('account')
    const [done, action] = useActionState(revokeOtherSessions, null)
    const tell = useEffectEvent((ended: number) => {
        toast.success(
            t('othersEnded', {
                count: ended,
            }),
        )
    })
    useEffect(() => {
        if (done) tell(done.ended)
    }, [
        done,
    ])
    return (
        <form action={action}>
            <Button
                type="submit"
                variant="outline"
            >
                {t('revokeOthers')}
            </Button>
        </form>
    )
}
