import { type Metadata, type Route } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { authorizePath, callbackUrl, parseAuthorizeRequest, type SilentError } from '@/lib/authorize/authorize'
import { backend } from '@/lib/backend/backend'
import { serverEnv } from '@/lib/env/server'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { currentSession } from '@/lib/session/current'

export const metadata: Metadata = {
    robots: PRIVATE_PAGE,
}

/**
 * Sign-in for the platform's apps (nick-lukashik.com): the app sends the
 * browser here, this page answers its callback with a one-time code for the
 * person signed in here, after a sign-in if needed. Nothing is ever sent to
 * an address id-api has not registered for the app: a bad request ends on
 * this page.
 *
 * `prompt=none` is an app's silent sign-in: the person did not ask, so no
 * page is shown. With a session here the code goes back as usual; without
 * one the callback gets `login_required` and the person stays there, signed
 * out.
 */
export default async function AuthorizePage({ searchParams }: PageProps<'/authorize'>) {
    const request = parseAuthorizeRequest(await searchParams)
    if (!request) return <Invalid />
    const answer = (error: SilentError): never =>
        redirect(
            callbackUrl(request.redirect_uri, request.state, {
                error,
            }) as Route,
        )

    const registered = await backend(
        'id',
        `/api/v1/oauth/clients/${request.client_id}?redirectUri=${encodeURIComponent(request.redirect_uri)}`,
    )
    if (!registered.ok) {
        if (registered.status < 500) return <Invalid />
        // An outage is not a bad link. A silent request to a known app's
        // callback is answered, so the person is not stranded here.
        const known = serverEnv.FORM_ACTION_ORIGINS.includes(new URL(request.redirect_uri).origin)
        if (request.silent && known) answer('temporarily_unavailable')
        throw new Error('id-api could not check the app')
    }

    const self = authorizePath(request)
    const session = await currentSession()
    if (!session) {
        if (request.silent) answer('login_required')
        redirect(`/login?continue=${encodeURIComponent(self)}` as Route)
    }

    const issued = await backend<{
        code: string
    }>('id', '/api/v1/oauth/authorize', {
        method: 'POST',
        token: session.accessToken,
        body: {
            clientId: request.client_id,
            redirectUri: request.redirect_uri,
            codeChallenge: request.code_challenge,
            codeChallengeMethod: 'S256',
        },
    })
    if (!issued.ok || !issued.data) {
        if (request.silent)
            answer(
                issued.status === 401
                    ? 'login_required'
                    : issued.status < 500
                      ? 'invalid_request'
                      : 'temporarily_unavailable',
            )
        if (issued.status === 401) redirect(`/login?reauth=1&continue=${encodeURIComponent(self)}` as Route)
        if (issued.status < 500) return <Invalid />
        throw new Error('id-api could not issue a code')
    }
    redirect(
        callbackUrl(request.redirect_uri, request.state, {
            code: issued.data.code,
        }) as Route,
    )
}

async function Invalid() {
    const t = await getTranslations('authorize')
    return (
        <div className="mx-auto flex max-w-md flex-col items-start gap-4">
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p>{t('body')}</p>
            <Button asChild>
                <a href="/account">{t('back')}</a>
            </Button>
        </div>
    )
}
