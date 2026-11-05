import { z } from 'zod'

const requestSchema = z.object({
    response_type: z.literal('code').optional(),
    client_id: z.string().regex(/^[a-z][a-z0-9-]{2,40}$/),
    redirect_uri: z.url().max(500),
    state: z.string().min(16).max(256),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal('S256'),
})

export type AuthorizeRequest = z.infer<typeof requestSchema>

/** A site's /authorize request from the query, or undefined for a broken link. */
export function parseAuthorizeRequest(
    query: Record<string, string | string[] | undefined>,
): AuthorizeRequest | undefined {
    const parsed = requestSchema.safeParse(
        Object.fromEntries(Object.entries(query).filter(([, value]) => typeof value === 'string')),
    )
    return parsed.success ? parsed.data : undefined
}

/** The same request: where sign-in returns to. */
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

/** The site's callback with a code and the state. */
export function callbackUrl(redirectUri: string, state: string, code: string) {
    const target = new URL(redirectUri)
    target.searchParams.set('code', code)
    target.searchParams.set('state', state)
    return target.toString()
}
