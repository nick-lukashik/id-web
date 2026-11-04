import { type Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { markAllRead, markRead } from '@/app/actions/notifications'
import { ShowMore } from '@/components/show-more'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Unavailable } from '@/components/unavailable'
import { actionErrorParam } from '@/lib/backend/action-error'
import { loadList, PAGE_SIZE, shownParam, withShown } from '@/lib/backend/list'
import { type Notification } from '@/lib/backend/types'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('notifications')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

const step = PAGE_SIZE.notifications
const href = (show: number) => withShown('/notifications', show, step)

export default async function NotificationsPage({ searchParams }: PageProps<'/notifications'>) {
    const session = await requireSession()
    const [t, errors, format, query] = await Promise.all([
        getTranslations('notifications'),
        getTranslations('actionErrors'),
        getFormatter(),
        searchParams,
    ])
    const show = shownParam(query.show, step)
    const error = actionErrorParam(query.error)
    const inbox = await loadList<
        Notification,
        {
            unreadCount: number
        }
    >('notifications', '/api/v1/me/notifications', session.accessToken, show)
    // The actions come back to the list as long as it was.
    const shown =
        show > step ? (
            <input
                type="hidden"
                name="show"
                value={show}
            />
        ) : null

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">{t('heading')}</h1>
                {inbox.first && inbox.first.unreadCount > 0 ? (
                    <form action={markAllRead}>
                        {shown}
                        <Button
                            type="submit"
                            variant="outline"
                        >
                            {t('readAll')}
                        </Button>
                    </form>
                ) : null}
            </div>
            {error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {errors(error)}
                </p>
            ) : null}
            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    {!inbox.first ? (
                        <Unavailable
                            message={t('unavailable')}
                            retry={href(show)}
                        />
                    ) : inbox.items.length === 0 ? (
                        <p className="text-muted-foreground">{t('empty')}</p>
                    ) : (
                        <>
                            <ul className="flex flex-col divide-y text-sm">
                                {inbox.items.map(item => (
                                    <li
                                        key={item.id}
                                        className="flex flex-wrap items-center justify-between gap-4 py-2"
                                    >
                                        <span className={item.read ? 'text-muted-foreground' : 'font-medium'}>
                                            {item.kind === 'wallet.credited'
                                                ? t('walletCredited', {
                                                      amount: Number(item.params.amount ?? 0),
                                                      balance: Number(item.params.balanceAfter ?? 0),
                                                  })
                                                : t('welcome')}
                                            {' · '}
                                            {format.dateTime(new Date(item.createdAt), {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            })}
                                        </span>
                                        {item.read ? null : (
                                            <form action={markRead}>
                                                <input
                                                    type="hidden"
                                                    name="notificationId"
                                                    value={item.id}
                                                />
                                                {shown}
                                                <Button
                                                    type="submit"
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    {t('markRead')}
                                                </Button>
                                            </form>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <ShowMore
                                list={inbox}
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
