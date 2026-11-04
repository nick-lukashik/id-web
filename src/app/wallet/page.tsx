import { randomUUID } from 'node:crypto'
import { type Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { startCheckout } from '@/app/actions/wallet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { backend } from '@/lib/backend/backend'
import { CURRENCIES, type Currency, type Page, type Product, type Wallet, type WalletTx } from '@/lib/backend/types'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('wallet')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

export default async function WalletPage({ searchParams }: PageProps<'/wallet'>) {
    const session = await requireSession()
    const [t, units, format, locale, query] = await Promise.all([
        getTranslations('wallet'),
        getTranslations('units'),
        getFormatter(),
        getLocale(),
        searchParams,
    ])
    const currency: Currency = CURRENCIES.find(value => value === query.currency) ?? (locale === 'ru' ? 'RUB' : 'USD')
    const [wallet, history, catalog] = await Promise.all([
        backend<Wallet>('wallet', '/api/v1/me/wallet', {
            token: session.accessToken,
        }),
        backend<Page<WalletTx>>('wallet', '/api/v1/me/wallet/history?limit=20', {
            token: session.accessToken,
        }),
        backend<{
            items: Product[]
        }>('pay', '/api/v1/catalog'),
    ])

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
            {query.paid ? <p role="status">{t('paid')}</p> : null}
            {query.error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {t('checkoutError')}
                </p>
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('balance')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-semibold tabular-nums">
                        {wallet.data
                            ? units('coins', {
                                  count: Number(wallet.data.balance),
                              })
                            : t('unavailable')}
                    </p>
                    {wallet.data?.state === 'restricted' ? (
                        <p className="mt-2 text-sm text-muted-foreground">{t('restricted')}</p>
                    ) : null}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('topUp')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <nav
                        aria-label={t('currency')}
                        className="flex gap-3 text-sm"
                    >
                        {CURRENCIES.map(value => (
                            <Link
                                key={value}
                                href={`/wallet?currency=${value}`}
                                aria-current={value === currency ? 'true' : undefined}
                                className="underline-offset-4 hover:underline aria-[current]:font-semibold"
                            >
                                {value}
                            </Link>
                        ))}
                    </nav>
                    {catalog.data ? (
                        <ul className="grid gap-3 sm:grid-cols-3">
                            {catalog.data.items.map(product => (
                                <li key={product.key}>
                                    <form
                                        action={startCheckout}
                                        className="flex flex-col gap-2 rounded-lg border p-4"
                                    >
                                        <input
                                            type="hidden"
                                            name="productKey"
                                            value={product.key}
                                        />
                                        <input
                                            type="hidden"
                                            name="currency"
                                            value={currency}
                                        />
                                        <input
                                            type="hidden"
                                            name="idempotencyKey"
                                            value={randomUUID()}
                                        />
                                        <span className="font-medium">
                                            {product.title[locale === 'ru' ? 'ru' : 'en']}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {format.number(Number(product.prices[currency]), {
                                                style: 'currency',
                                                currency,
                                            })}
                                        </span>
                                        <Button type="submit">{t('buy')}</Button>
                                    </form>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>{t('unavailable')}</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('history')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {history.data && history.data.items.length > 0 ? (
                        <ul className="flex flex-col divide-y text-sm">
                            {history.data.items.map(item => (
                                <li
                                    key={item.id}
                                    className="flex justify-between gap-4 py-2"
                                >
                                    <span>
                                        {t(`kinds.${item.kind}`)}
                                        {' · '}
                                        {format.dateTime(new Date(item.createdAt), {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                        })}
                                    </span>
                                    <span className="tabular-nums">{item.amount}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('empty')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
