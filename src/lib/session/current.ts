import 'server-only'
import { isIP } from 'node:net'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { serverEnv } from '@/lib/env/server'
import { cookieNames, openSession, type Session } from './session'

export const isHttps = () => serverEnv.SITE_URL.startsWith('https://')

/** The session of this request (the proxy has refreshed it if it was about to expire). */
export async function currentSession(): Promise<Session | undefined> {
    return openSession((await cookies()).get(cookieNames(isHttps()).session)?.value)
}

/** Pages and actions behind sign-in: no session goes to /login. */
export async function requireSession(): Promise<Session> {
    const session = await currentSession()
    if (!session) redirect('/login')
    return session
}

/**
 * The browser's address, for the rate limits and the sessions list of id-api.
 * cf-connecting-ip is set by Cloudflare on every request and can be trusted:
 * only Cloudflare reaches Traefik (it requires Cloudflare's Authenticated
 * Origin Pulls certificate) and only Traefik reaches this server
 * (NetworkPolicy). x-forwarded-for and x-real-ip can carry what the browser
 * sent, so only local runs (plain HTTP, no Cloudflare) fall back to them.
 * The first candidate that is an IP counts.
 */
export async function clientIp(): Promise<string | undefined> {
    const request = await headers()
    const cloudflare = request.get('cf-connecting-ip')
    const candidates =
        cloudflare !== null || isHttps()
            ? [
                  cloudflare,
              ]
            : [
                  request.get('x-forwarded-for')?.split(',')[0],
                  request.get('x-real-ip'),
              ]
    return candidates.map(value => value?.trim()).find(value => value && isIP(value))
}
