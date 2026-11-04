'use server'

import { type Route } from 'next'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { backend } from '@/lib/backend/backend'
import { requireSession } from '@/lib/session/current'

const checkoutSchema = z.object({
    productKey: z.string().regex(/^[a-z0-9-]{1,64}$/),
    currency: z.enum([
        'RUB',
        'USD',
        'EUR',
    ]),
    /** Rendered with the form: a double submit is the same checkout. */
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
})

/** A GRM pack: pay-api creates the payment and returns where to pay. */
export async function startCheckout(form: FormData) {
    const session = await requireSession()
    const input = checkoutSchema.safeParse(Object.fromEntries(form))
    if (!input.success) redirect('/wallet?error=checkout')
    const result = await backend<{
        checkoutUrl: string | null
    }>('pay', '/api/v1/me/checkout', {
        method: 'POST',
        token: session.accessToken,
        idempotencyKey: input.data.idempotencyKey,
        body: {
            productKey: input.data.productKey,
            currency: input.data.currency,
        },
    })
    // The provider's page (or id-web's own for the fake provider): an http(s) URL from pay-api only.
    const url = z
        .url({
            protocol: /^https?$/,
        })
        .safeParse(result.data?.checkoutUrl)
    if (!result.ok || !url.success) redirect('/wallet?error=checkout')
    redirect(url.data as Route)
}

/** The test provider's pay button. */
export async function completeFakePayment(form: FormData) {
    const session = await requireSession()
    const id = z.uuid().safeParse(form.get('paymentId'))
    if (!id.success) redirect('/payments')
    const result = await backend('pay', `/api/v1/me/payments/${id.data}/fake-complete`, {
        method: 'POST',
        token: session.accessToken,
    })
    redirect(result.ok ? '/wallet?paid=1' : '/payments?error=payment')
}
