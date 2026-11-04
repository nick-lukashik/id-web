import { type Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { revokeOtherSessions, revokeSession, updateProfile } from '@/app/actions/account'
import { removePasskey, unlinkGoogle } from '@/app/actions/passkeys'
import { AddPasskey } from '@/components/add-passkey'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { backend } from '@/lib/backend/backend'
import { type GoogleConfig, type GoogleError } from '@/lib/google/google'
import { type PasskeyItem } from '@/lib/passkeys/passkeys'
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
    authMethod: 'email' | 'google' | 'passkey' | 'sso'
    clientId: string | null
    current: boolean
}
type Identity = {
    provider: 'google'
    email: string | null
}

/** The apps that sign in through this site, as people know them. */
const APP_NAMES: Record<string, string> = {
    'landing-web': 'nick-lukashik.com',
}

const GOOGLE_ERRORS: readonly GoogleError[] = [
    'google_failed',
    'google_cancelled',
    'google_unavailable',
    'google_link_required',
    'google_unverified',
    'google_in_use',
    'google_already_linked',
    'google_suspended',
    'google_reauth_required',
    'google_session_changed',
]

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
    const session = await requireSession()
    const [t, format, { saved, error, linked, unlinked }] = await Promise.all([
        getTranslations('account'),
        getFormatter(),
        searchParams,
    ])
    const [profile, sessions, passkeys, identities, google] = await Promise.all([
        backend<Profile>('id', '/api/v1/me', {
            token: session.accessToken,
        }),
        backend<{
            items: SessionItem[]
        }>('id', '/api/v1/me/sessions', {
            token: session.accessToken,
        }),
        backend<{
            items: PasskeyItem[]
        }>('id', '/api/v1/me/passkeys', {
            token: session.accessToken,
        }),
        backend<{
            items: Identity[]
        }>('id', '/api/v1/me/identities', {
            token: session.accessToken,
        }),
        backend<GoogleConfig>('id', '/api/v1/login/google/config'),
    ])
    const googleError = GOOGLE_ERRORS.find(value => value === error)
    const linkedGoogle = identities.data?.items.find(item => item.provider === 'google')
    const dateOf = (iso: string) =>
        format.dateTime(new Date(iso), {
            dateStyle: 'medium',
        })
    if (!profile.data) return <p role="alert">{t('unavailable')}</p>

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-semibold">{t('heading')}</h1>
            {saved ? <p role="status">{t('saved')}</p> : null}
            {linked === 'google' ? <p role="status">{t('linkedGoogle')}</p> : null}
            {unlinked === 'google' ? <p role="status">{t('unlinkedGoogle')}</p> : null}
            {error ? (
                <p
                    role="alert"
                    className="text-destructive"
                >
                    {googleError ? t(`googleErrors.${googleError}`) : t('error')}
                    {googleError === 'google_reauth_required' ? (
                        <>
                            {' '}
                            <Link
                                href="/login?reauth=1&continue=%2Faccount"
                                className="underline underline-offset-4"
                            >
                                {t('reauth')}
                            </Link>
                        </>
                    ) : null}
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
                        <h2>{t('methods')}</h2>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 text-sm">
                    <p>
                        {t('emailMethod', {
                            email: profile.data.email,
                        })}
                    </p>
                    {google.data?.enabled ? (
                        <section
                            aria-labelledby="google-heading"
                            className="flex flex-wrap items-center justify-between gap-3"
                        >
                            <div>
                                <h3
                                    id="google-heading"
                                    className="font-medium"
                                >
                                    {t('google')}
                                </h3>
                                <p className="text-muted-foreground">
                                    {linkedGoogle
                                        ? t('googleLinked', {
                                              email: linkedGoogle.email ?? '—',
                                          })
                                        : t('googleNotLinked')}
                                </p>
                            </div>
                            {linkedGoogle ? (
                                <form action={unlinkGoogle}>
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        size="sm"
                                    >
                                        {t('unlink')}
                                    </Button>
                                </form>
                            ) : (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                >
                                    <a href="/login/google?intent=link&continue=%2Faccount">{t('link')}</a>
                                </Button>
                            )}
                        </section>
                    ) : null}
                    <section
                        aria-labelledby="passkeys-heading"
                        className="flex flex-col gap-3"
                    >
                        <div>
                            <h3
                                id="passkeys-heading"
                                className="font-medium"
                            >
                                {t('passkeys')}
                            </h3>
                            <p className="text-muted-foreground">{t('passkeysLead')}</p>
                        </div>
                        {passkeys.data && passkeys.data.items.length > 0 ? (
                            <ul className="flex flex-col divide-y">
                                {passkeys.data.items.map(item => (
                                    <li
                                        key={item.id}
                                        className="flex items-center justify-between gap-4 py-2"
                                    >
                                        <span>
                                            {item.name}
                                            {item.synced ? ` · ${t('synced')}` : null}
                                            {' · '}
                                            {item.lastUsedAt
                                                ? t('lastUsed', {
                                                      date: dateOf(item.lastUsedAt),
                                                  })
                                                : t('neverUsed')}
                                        </span>
                                        <form action={removePasskey}>
                                            <input
                                                type="hidden"
                                                name="passkeyId"
                                                value={item.id}
                                            />
                                            <Button
                                                type="submit"
                                                variant="outline"
                                                size="sm"
                                            >
                                                {t('removePasskey')}
                                            </Button>
                                        </form>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">{t('noPasskeys')}</p>
                        )}
                        <AddPasskey />
                    </section>
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
                                    {item.authMethod === 'sso'
                                        ? t('methodNames.sso', {
                                              app: APP_NAMES[item.clientId ?? ''] ?? item.clientId ?? '—',
                                          })
                                        : t(`methodNames.${item.authMethod}`)}
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
