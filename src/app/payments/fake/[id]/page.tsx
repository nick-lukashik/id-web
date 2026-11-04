import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { completeFakePayment } from '@/app/actions/wallet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signInAgainOn401 } from '@/lib/backend/action-error'
import { backend } from '@/lib/backend/backend'
import { type Payment } from '@/lib/backend/types'
import { serverEnv } from '@/lib/env/server'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    // Without pay-api there are no payments: not found, title included.
    if (!serverEnv.PAYMENTS_ENABLED) notFound()
    const t = await getTranslations('fakePay')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

/** The checkout page of the test provider: no money moves. */
export default async function FakePaymentPage({ params }: PageProps<'/payments/fake/[id]'>) {
    if (!serverEnv.PAYMENTS_ENABLED) notFound()
    const session = await requireSession()
    const id = z.uuid().safeParse((await params).id)
    if (!id.success) notFound()
    const [t, units, format, payment] = await Promise.all([
        getTranslations('fakePay'),
        getTranslations('units'),
        getFormatter(),
        backend<Payment>('pay', `/api/v1/me/payments/${id.data}`, {
            token: session.accessToken,
        }),
    ])
    await signInAgainOn401(`/payments/fake/${id.data}`, payment)
    if (payment.data?.provider !== 'fake') notFound()

    return (
        <div className="mx-auto max-w-md">
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h1 className="text-xl font-semibold">{t('heading')}</h1>
                    </CardTitle>
                    <CardDescription>{t('lead')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <p>
                        {units('coins', {
                            count: Number(payment.data.coins),
                        })}
                        {' · '}
                        {format.number(Number(payment.data.amount), {
                            style: 'currency',
                            currency: payment.data.currency,
                        })}
                    </p>
                    {payment.data.status === 'pending' ? (
                        <form action={completeFakePayment}>
                            <input
                                type="hidden"
                                name="paymentId"
                                value={payment.data.id}
                            />
                            <Button type="submit">{t('pay')}</Button>
                        </form>
                    ) : (
                        <p role="status">{t('done')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
