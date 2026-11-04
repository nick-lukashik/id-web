import { type Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { revokeOtherSessions, revokeSession, updateProfile } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { backend } from '@/lib/backend/backend'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { requireSession } from '@/lib/session/current'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('account')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

type Profile = {
    email: string
    displayName: string | null
    locale: 'en' | 'ru'
    roles: string[]
}
type SessionItem = {
    id: string
    lastActiveAt: string
    userAgent: string | null
    current: boolean
}

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
    const session = await requireSession()
    const [t, format, { saved, error }] = await Promise.all([
        getTranslations('account'),
        getFormatter(),
        searchParams,
    ])
    const [profile, sessions] = await Promise.all([
        backend<Profile>('id', '/api/v1/me', {
            token: session.accessToken,
        }),
        backend<{
            items: SessionItem[]
        }>('id', '/api/v1/me/sessions', {
            token: session.accessToken,
        }),
    ])
    if (!profile.data) return <p role="alert">{t('unavailable')}</p>

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
            {saved ? <p role="status">{t('saved')}</p> : null}
            {error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {t('error')}
                </p>
            ) : null}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('profile')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                        {t('email', {
                            email: profile.data.email,
                        })}
                        {profile.data.roles.length > 0
                            ? ` · ${t('roles', {
                                  roles: profile.data.roles.join(', '),
                              })}`
                            : null}
                    </p>
                    <form
                        action={updateProfile}
                        className="grid max-w-md gap-3"
                    >
                        <Label htmlFor="displayName">{t('displayName')}</Label>
                        <Input
                            id="displayName"
                            name="displayName"
                            maxLength={80}
                            defaultValue={profile.data.displayName ?? ''}
                        />
                        <Label htmlFor="locale">{t('language')}</Label>
                        <select
                            id="locale"
                            name="locale"
                            defaultValue={profile.data.locale}
                            className="h-11 rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                            <option value="en">English</option>
                            <option value="ru">Русский</option>
                        </select>
                        <Button
                            type="submit"
                            className="justify-self-start"
                        >
                            {t('save')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('sessions')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <ul className="flex flex-col divide-y">
                        {(sessions.data?.items ?? []).map(item => (
                            <li
                                key={item.id}
                                className="flex items-center justify-between gap-4 py-2 text-sm"
                            >
                                <span>
                                    {item.userAgent ?? t('unknownDevice')}
                                    {' · '}
                                    {format.dateTime(new Date(item.lastActiveAt), {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                    })}
                                    {item.current ? ` · ${t('thisDevice')}` : null}
                                </span>
                                {item.current ? null : (
                                    <form action={revokeSession}>
                                        <input
                                            type="hidden"
                                            name="sessionId"
                                            value={item.id}
                                        />
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            size="sm"
                                        >
                                            {t('revoke')}
                                        </Button>
                                    </form>
                                )}
                            </li>
                        ))}
                    </ul>
                    <form action={revokeOtherSessions}>
                        <Button
                            type="submit"
                            variant="outline"
                        >
                            {t('revokeOthers')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
