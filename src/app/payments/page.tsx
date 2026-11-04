import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ShowMore } from '@/components/show-more'
import { Card, CardContent } from '@/components/ui/card'
import { Unavailable } from '@/components/unavailable'
import { signInAgainOn401 } from '@/lib/backend/action-error'
import { loadList, PAGE_SIZE, shownParam, withShown } from '@/lib/backend/list'
import { type Payment } from '@/lib/backend/types'
import { serverEnv } from '@/lib/env/server'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    // Without pay-api there are no payments: not found, title included.
    if (!serverEnv.PAYMENTS_ENABLED) notFound()
    const t = await getTranslations('payments')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

const step = PAGE_SIZE.payments
const href = (show: number) => withShown('/payments', show, step)

export default async function PaymentsPage({ searchParams }: PageProps<'/payments'>) {
    if (!serverEnv.PAYMENTS_ENABLED) notFound()
    const session = await requireSession()
    const [t, units, format, query] = await Promise.all([
        getTranslations('payments'),
        getTranslations('units'),
        getFormatter(),
        searchParams,
    ])
    const show = shownParam(query.show, step)
    const payments = await loadList<Payment>('pay', '/api/v1/me/payments', session.accessToken, show)
    await signInAgainOn401(href(show), payments)

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
            {/* Sent here by the checkout; a refresh that finds the payment ready no longer says it. */}
            {query.creating && payments.items.some(payment => payment.status === 'creating') ? (
                <p role="status">{t('creating')}</p>
            ) : null}
            {query.error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {t('error')}
                </p>
            ) : null}
            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    {!payments.first ? (
                        <Unavailable
                            message={t('unavailable')}
                            retry={href(show)}
                        />
                    ) : payments.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('empty')}</p>
                    ) : (
                        <>
                            <ul className="flex flex-col divide-y text-sm">
                                {payments.items.map(payment => (
                                    <li
                                        key={payment.id}
                                        className="flex flex-wrap justify-between gap-4 py-2"
                                    >
                                        <span>
                                            {units('coins', {
                                                count: Number(payment.coins),
                                            })}
                                            {' · '}
                                            {format.number(Number(payment.amount), {
                                                style: 'currency',
                                                currency: payment.currency,
                                            })}
                                            {' · '}
                                            {format.dateTime(new Date(payment.createdAt), {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            })}
                                        </span>
                                        <span className="flex gap-3">
                                            {t(`status.${payment.status}`)}
                                            {payment.checkoutUrl ? (
                                                <a
                                                    href={payment.checkoutUrl}
                                                    className="underline underline-offset-4"
                                                >
                                                    {t('continue')}
                                                </a>
                                            ) : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <ShowMore
                                list={payments}
                                show={show}
                                step={step}
                                href={href}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
