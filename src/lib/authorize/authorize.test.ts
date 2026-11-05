import { describe, expect, it } from 'vitest'
import { authorizePath, callbackUrl, parseAuthorizeRequest } from './authorize'

const query = {
    response_type: 'code',
    client_id: 'landing-web',
    redirect_uri: 'https://nick-lukashik.com/auth/callback',
    state: 's'.repeat(32),
    code_challenge: 'c'.repeat(43),
    code_challenge_method: 'S256',
}

describe('parseAuthorizeRequest', () => {
    it('reads a request', () => {
        expect(parseAuthorizeRequest(query)?.client_id).toBe(query.client_id)
    })

    it('refuses broken links', () => {
        expect(
            parseAuthorizeRequest({
                ...query,
                code_challenge_method: 'plain',
            }),
        ).toBeUndefined()
        expect(
            parseAuthorizeRequest({
                ...query,
                state: 'short',
            }),
        ).toBeUndefined()
        expect(
            parseAuthorizeRequest({
                ...query,
                client_id: undefined,
            }),
        ).toBeUndefined()
    })
})

describe('authorizePath and callbackUrl', () => {
    it('come back to the same request, and answer with the code and the state', () => {
        const request = parseAuthorizeRequest(query)
        if (!request) throw new Error('expected a request')
        expect(authorizePath(request)).toContain(`state=${query.state}`)
        expect(callbackUrl(query.redirect_uri, query.state, 'abc')).toBe(
            `https://nick-lukashik.com/auth/callback?code=abc&state=${query.state}`,
        )
    })
})
