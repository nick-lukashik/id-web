import { type Metadata, type Route } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { resendLogin, restartLogin, startLogin, verifyLogin } from '@/app/actions/login'
import { PasskeySignIn } from '@/components/passkey-sign-in'
import { ResendCode } from '@/components/resend-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { backend } from '@/lib/backend/backend'
import { type GoogleConfig } from '@/lib/google/google'
import { safeContinue } from '@/lib/session/continue'
import { currentSession, isHttps } from '@/lib/session/current'
import { cookieNames, openLogin } from '@/lib/session/session'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('login')
    return {
        title: t('title'),
    }
}

const ERRORS = [
    'email',
    'delivery_failed',
    'rate_limited',
    'unavailable',
    'invalid_code',
    'expired',
    'too_many_attempts',
    'google_failed',
    'google_cancelled',
    'google_unavailable',
    'google_link_required',
    'google_unverified',
    'google_suspended',
] as const
type LoginError = (typeof ERRORS)[number]

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** The `wait` of a rate limit, in seconds; a day at most, id-api's longest window. */
const waitOf = (value: string | undefined) => {
    const seconds = Number(value)
    return Number.isInteger(seconds) && seconds > 0 && seconds <= 86_400 ? seconds : undefined
}

/**
 * Sign-in: an email code (always), a passkey, or Google when it is set up.
 * `continue` is where to go after it (an app's /authorize included);
 * `reauth=1` signs in again while signed in, to confirm it is you.
 */
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
    const query = await searchParams
    const continueTo = safeContinue(first(query.continue))
    const reauth = first(query.reauth) === '1'
    if ((await currentSession()) && !reauth) redirect(continueTo as Route)
    const [t, format] = await Promise.all([
        getTranslations('login'),
        getFormatter(),
    ])
    const error = first(query.error)
    const known: LoginError | undefined = error ? (ERRORS.find(value => value === error) ?? 'unavailable') : undefined
    const wait = known === 'rate_limited' ? waitOf(first(query.wait)) : undefined
    const pending = openLogin((await cookies()).get(cookieNames(isHttps()).login)?.value)
    const google = pending ? undefined : await backend<GoogleConfig>('id', '/api/v1/login/google/config')
    const now = Date.now()
    // Seconds until id-api takes another code request (older login cookies lack `resendAfter`).
    const resendIn = pending?.resendAfter ? Math.max(0, Math.ceil((pending.resendAfter - now) / 1000)) : 0

    return (
        <div className="mx-auto max-w-md">
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h1 className="text-xl font-semibold">{t('heading')}</h1>
                    </CardTitle>
                    <CardDescription>
                        {pending
                            ? t(first(query.resent) === '1' ? 'codeResent' : 'codeSent', {
                                  email: pending.email,
                              })
                            : reauth
                              ? t('reauthLead')
                              : t('lead')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {known ? (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {wait
                                ? t('errors.rate_limited_wait', {
                                      when: format.relativeTime(now + wait * 1000, now),
                                  })
                                : t(`errors.${known}`)}
                        </p>
                    ) : null}
                    {pending ? (
                        <>
                            <form
                                action={verifyLogin}
                                className="flex flex-col gap-3"
                            >
                                <input
                                    type="hidden"
                                    name="continue"
                                    value={continueTo}
                                />
                                <Label htmlFor="code">{t('code')}</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9 ]{6,7}"
                                    maxLength={7}
                                    required
                                    autoFocus
                                />
                                <Button type="submit">{t('verify')}</Button>
                            </form>
                            <div className="flex flex-wrap gap-x-6">
                                <form action={resendLogin}>
                                    <input
                                        type="hidden"
                                        name="continue"
                                        value={continueTo}
                                    />
                                    {/* A new cooldown is a new countdown. */}
                                    <ResendCode
                                        key={pending.resendAfter}
                                        wait={resendIn}
                                    />
                                </form>
                                <form action={restartLogin}>
                                    <input
                                        type="hidden"
                                        name="continue"
                                        value={continueTo}
                                    />
                                    <Button
                                        type="submit"
                                        variant="link"
                                        className="px-0"
                                    >
                                        {t('otherEmail')}
                                    </Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <>
                            <form
                                action={startLogin}
                                className="flex flex-col gap-3"
                            >
                                <input
                                    type="hidden"
                                    name="continue"
                                    value={continueTo}
                                />
                                <Label htmlFor="email">{t('email')}</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    // `webauthn`: the browser offers passkeys in this field's autofill.
                                    autoComplete="username webauthn"
                                    required
                                    autoFocus
                                />
                                <Button type="submit">{t('send')}</Button>
                            </form>
                            <p className="flex items-center gap-3 text-xs text-muted-foreground uppercase before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                                {t('or')}
                            </p>
                            <PasskeySignIn continueTo={continueTo} />
                            {google?.data?.enabled ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    size="lg"
                                >
                                    {/* A link, not a form: see /login/google. */}
                                    <a href={`/login/google?continue=${encodeURIComponent(continueTo)}`}>
                                        {t('google')}
                                    </a>
                                </Button>
                            ) : null}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
