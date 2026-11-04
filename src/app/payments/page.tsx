import { type Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'
import { backend } from '@/lib/backend/backend'
import { type Page, type Payment } from '@/lib/backend/types'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('payments')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

export default async function PaymentsPage({ searchParams }: PageProps<'/payments'>) {
    const session = await requireSession()
    const [t, format, { error }] = await Promise.all([
        getTranslations('payments'),
        getFormatter(),
        searchParams,
    ])
    const payments = await backend<Page<Payment>>('pay', '/api/v1/me/payments?limit=20', {
        token: session.accessToken,
    })

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
            {error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {t('error')}
                </p>
            ) : null}
            <Card>
                <CardContent className="pt-6">
                    {payments.data && payments.data.items.length > 0 ? (
                        <ul className="flex flex-col divide-y text-sm">
                            {payments.data.items.map(payment => (
                                <li
                                    key={payment.id}
                                    className="flex flex-wrap justify-between gap-4 py-2"
                                >
                                    <span>
                                        {payment.grm} GRM
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
                    ) : (
                        <p className="text-sm text-muted-foreground">{payments.data ? t('empty') : t('unavailable')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
