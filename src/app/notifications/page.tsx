import { type Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { markAllRead, markRead } from '@/app/actions/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { backend } from '@/lib/backend/backend'
import { type Notification, type Page } from '@/lib/backend/types'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('notifications')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

export default async function NotificationsPage() {
    const session = await requireSession()
    const [t, format, inbox] = await Promise.all([
        getTranslations('notifications'),
        getFormatter(),
        backend<
            Page<Notification> & {
                unreadCount: number
            }
        >('notifications', '/api/v1/me/notifications?limit=30', {
            token: session.accessToken,
        }),
    ])

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">{t('heading')}</h1>
                {inbox.data && inbox.data.unreadCount > 0 ? (
                    <form action={markAllRead}>
                        <Button
                            type="submit"
                            variant="outline"
                        >
                            {t('readAll')}
                        </Button>
                    </form>
                ) : null}
            </div>
            <Card>
                <CardContent className="pt-6">
                    {inbox.data && inbox.data.items.length > 0 ? (
                        <ul className="flex flex-col divide-y text-sm">
                            {inbox.data.items.map(item => (
                                <li
                                    key={item.id}
                                    className="flex flex-wrap items-center justify-between gap-4 py-2"
                                >
                                    <span className={item.read ? 'text-muted-foreground' : 'font-medium'}>
                                        {item.kind === 'wallet.credited'
                                            ? t('walletCredited', {
                                                  amount: item.params.amount ?? '',
                                                  balance: item.params.balanceAfter ?? '',
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
                    ) : (
                        <p className="text-muted-foreground">{inbox.data ? t('empty') : t('unavailable')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
