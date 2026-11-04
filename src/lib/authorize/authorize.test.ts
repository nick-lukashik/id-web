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
    it('reads a request and whether it is silent', () => {
        expect(parseAuthorizeRequest(query)?.silent).toBe(false)
        expect(
            parseAuthorizeRequest({
                ...query,
                prompt: 'none',
            })?.silent,
        ).toBe(true)
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
    it('come back without prompt, and answer with the state', () => {
        const request = parseAuthorizeRequest({
            ...query,
            prompt: 'none',
        })
        if (!request) throw new Error('expected a request')
        expect(authorizePath(request)).not.toContain('prompt')
        expect(
            callbackUrl(query.redirect_uri, query.state, {
                code: 'abc',
            }),
        ).toBe(`https://nick-lukashik.com/auth/callback?code=abc&state=${query.state}`)
        expect(
            callbackUrl(query.redirect_uri, query.state, {
                error: 'login_required',
            }),
        ).toContain('error=login_required')
    })
})
