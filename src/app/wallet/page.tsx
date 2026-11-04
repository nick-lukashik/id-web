import { randomUUID } from 'node:crypto'
import { type Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { startCheckout } from '@/app/actions/wallet'
import { ShowMore } from '@/components/show-more'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Unavailable } from '@/components/unavailable'
import { signInAgainOn401 } from '@/lib/backend/action-error'
import { backend } from '@/lib/backend/backend'
import { loadList, PAGE_SIZE, shownParam, withShown } from '@/lib/backend/list'
import { CURRENCIES, type Currency, type Product, type Wallet, type WalletTx } from '@/lib/backend/types'
import { serverEnv } from '@/lib/env/server'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('wallet')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

const step = PAGE_SIZE.walletHistory

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
    const show = shownParam(query.show, step)
    // The address as it is: a retry or "Show more" keeps the currency.
    const href = (count: number) => withShown(query.currency ? `/wallet?currency=${currency}` : '/wallet', count, step)
    const [wallet, history, catalog] = await Promise.all([
        backend<Wallet>('wallet', '/api/v1/me/wallet', {
            token: session.accessToken,
        }),
        loadList<WalletTx>('wallet', '/api/v1/me/wallet/history', session.accessToken, show),
        // Coin packs only where pay-api runs.
        serverEnv.PAYMENTS_ENABLED
            ? backend<{
                  items: Product[]
              }>('pay', '/api/v1/catalog')
            : undefined,
    ])
    signInAgainOn401(href(show), wallet, history)

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
                    {wallet.data ? (
                        <p className="text-3xl font-semibold tabular-nums">
                            {units('coins', {
                                count: Number(wallet.data.balance),
                            })}
                        </p>
                    ) : (
                        <Unavailable
                            message={t('unavailable')}
                            retry={href(show)}
                        />
                    )}
                    {wallet.data?.state === 'restricted' ? (
                        <p className="mt-2 text-sm text-muted-foreground">{t('restricted')}</p>
                    ) : null}
                </CardContent>
            </Card>
            {catalog ? (
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
                        {!catalog.data ? (
                            <Unavailable
                                message={t('unavailable')}
                                retry={href(show)}
                            />
                        ) : catalog.data.items.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('noPacks')}</p>
                        ) : (
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
                        )}
                    </CardContent>
                </Card>
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2 id="history-heading">{t('history')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {!history.first ? (
                        <Unavailable
                            message={t('historyUnavailable')}
                            retry={href(show)}
                        />
                    ) : history.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('empty')}</p>
                    ) : (
                        <>
                            <ul
                                aria-labelledby="history-heading"
                                className="flex flex-col divide-y text-sm"
                            >
                                {history.items.map(item => (
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
                            <ShowMore
                                list={history}
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
