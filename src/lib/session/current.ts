import 'server-only'
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

/** The client address Traefik set (real-ip), for the rate limits of id-api. */
export async function clientIp(): Promise<string | undefined> {
    const request = await headers()
    const value = request.get('x-real-ip') ?? request.get('x-forwarded-for')?.split(',')[0]
    return value?.trim() || undefined
}
