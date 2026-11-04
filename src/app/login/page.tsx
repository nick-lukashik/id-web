import { type Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { restartLogin, startLogin, verifyLogin } from '@/app/actions/login'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    'rate_limited',
    'unavailable',
    'invalid_code',
    'expired',
    'too_many_attempts',
] as const
type LoginError = (typeof ERRORS)[number]

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
    if (await currentSession()) redirect('/account')
    const t = await getTranslations('login')
    const { error } = await searchParams
    const known: LoginError | undefined = error ? (ERRORS.find(value => value === error) ?? 'unavailable') : undefined
    const pending = openLogin((await cookies()).get(cookieNames(isHttps()).login)?.value)

    return (
        <div className="mx-auto max-w-md">
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h1 className="text-xl font-semibold">{t('heading')}</h1>
                    </CardTitle>
                    <CardDescription>
                        {pending
                            ? t('codeSent', {
                                  email: pending.email,
                              })
                            : t('lead')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {known ? (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {t(`errors.${known}`)}
                        </p>
                    ) : null}
                    {pending ? (
                        <>
                            <form
                                action={verifyLogin}
                                className="flex flex-col gap-3"
                            >
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
                            <form action={restartLogin}>
                                <Button
                                    type="submit"
                                    variant="link"
                                    className="px-0"
                                >
                                    {t('otherEmail')}
                                </Button>
                            </form>
                        </>
                    ) : (
                        <form
                            action={startLogin}
                            className="flex flex-col gap-3"
                        >
                            <Label htmlFor="email">{t('email')}</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                autoFocus
                            />
                            <Button type="submit">{t('send')}</Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
