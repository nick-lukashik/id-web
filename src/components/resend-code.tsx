'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'

/**
 * The submit button of "send a new code": disabled for the `wait` seconds
 * left of id-api's cooldown, with the count on it. Without JavaScript it
 * stays as the server rendered it until the page is loaded again.
 */
export function ResendCode({ wait }: { wait: number }) {
    const t = useTranslations('login')
    const { pending } = useFormStatus()
    const [left, setLeft] = useState(wait)

    useEffect(() => {
        if (wait <= 0) return
        // Counted on the browser's clock from the server's figure: the two clocks may differ.
        const start = Date.now()
        const timer = setInterval(() => {
            const rest = Math.max(0, wait - Math.floor((Date.now() - start) / 1000))
            setLeft(rest)
            if (rest === 0) clearInterval(timer)
        }, 1000)
        return () => clearInterval(timer)
    }, [
        wait,
    ])

    return (
        <Button
            type="submit"
            variant="link"
            className="px-0"
            disabled={left > 0 || pending}
        >
            {left > 0
                ? t('resendIn', {
                      seconds: left,
                  })
                : t('resend')}
        </Button>
    )
}
