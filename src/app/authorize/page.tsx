import { type Metadata, type Route } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { authorizePath, callbackUrl, parseAuthorizeRequest } from '@/lib/authorize/authorize'
import { backend } from '@/lib/backend/backend'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { currentSession } from '@/lib/session/current'

export const metadata: Metadata = {
    robots: PRIVATE_PAGE,
}

/**
 * Sign-in for a site on another domain, which cannot read the session cookie: the
 * site sends the browser here, and this page answers its callback with a one-time
 * code for the person signed in here, after a sign-in if needed. Nothing is ever sent
 * to an address id-api has not registered for the site: a bad request ends on this page.
 */
export default async function AuthorizePage({ searchParams }: PageProps<'/authorize'>) {
    const request = parseAuthorizeRequest(await searchParams)
    if (!request) return <Invalid />
    const registered = await backend(
        'id',
        `/api/v1/oauth/clients/${request.client_id}?redirectUri=${encodeURIComponent(request.redirect_uri)}`,
    )
    if (!registered.ok) {
        if (registered.status < 500) return <Invalid />
        throw new Error('id-api could not check the site')
    }

    const self = authorizePath(request)
    const session = await currentSession()
    if (!session) redirect(`/login?continue=${encodeURIComponent(self)}` as Route)

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
        if (issued.status === 401) redirect(`/login?reauth=1&continue=${encodeURIComponent(self)}` as Route)
        if (issued.status < 500) return <Invalid />
        throw new Error('id-api could not issue a code')
    }
    redirect(callbackUrl(request.redirect_uri, request.state, issued.data.code) as Route)
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
