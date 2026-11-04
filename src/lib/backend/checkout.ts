import { z } from 'zod'

/** What starts a checkout: the wallet's form, or the payments page asking again with the same key. */
export const checkoutSchema = z.object({
    productKey: z.string().regex(/^[a-z0-9-]{1,64}$/),
    currency: z.enum([
        'RUB',
        'USD',
        'EUR',
    ]),
    /** Rendered with the form: a double submit is the same checkout. */
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/),
})
