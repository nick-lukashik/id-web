import { z } from 'zod'

const requestSchema = z.object({
    response_type: z.literal('code').optional(),
    client_id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
    redirect_uri: z.url().max(500),
    state: z.string().min(16).max(256),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal('S256'),
    // Only `none` changes anything; other prompts are ignored like any unknown parameter.
    prompt: z.string().optional(),
})

export type AuthorizeRequest = z.infer<typeof requestSchema> & {
    /** `prompt=none`: an app's silent sign-in, no page is shown. */
    silent: boolean
}

/** An app's /authorize request from the query, or undefined for a broken link. */
export function parseAuthorizeRequest(
    query: Record<string, string | string[] | undefined>,
): AuthorizeRequest | undefined {
    const parsed = requestSchema.safeParse(
        Object.fromEntries(Object.entries(query).filter(([, value]) => typeof value === 'string')),
    )
    if (!parsed.success) return undefined
    return {
        ...parsed.data,
        silent: parsed.data.prompt === 'none',
    }
}

/** The same request without `prompt`: where sign-in returns to. */
export function authorizePath(request: AuthorizeRequest) {
    return `/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: request.client_id,
        redirect_uri: request.redirect_uri,
        state: request.state,
        code_challenge: request.code_challenge,
        code_challenge_method: 'S256',
    })}`
}

/** What a silent request gets instead of a page: OIDC error codes. */
export type SilentError = 'login_required' | 'invalid_request' | 'temporarily_unavailable'

/** The app's callback with a code, or with an error, and the state either way. */
export function callbackUrl(
    redirectUri: string,
    state: string,
    answer:
        | {
              code: string
          }
        | {
              error: SilentError
          },
) {
    const target = new URL(redirectUri)
    if ('code' in answer) target.searchParams.set('code', answer.code)
    else target.searchParams.set('error', answer.error)
    target.searchParams.set('state', state)
    return target.toString()
}
