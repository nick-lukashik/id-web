import 'server-only'
import { headers as requestHeaders } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { serverEnv } from '@/lib/env/server'
import { logger } from '@/lib/logger'
import { REQUEST_ID_HEADER, requestIdFrom } from '@/lib/request-id'
import { clientIp } from '@/lib/session/current'

export type Service = 'id' | 'wallet' | 'pay' | 'notifications'

const bases: Record<Service, string> = {
    id: serverEnv.ID_API_URL,
    wallet: serverEnv.WALLET_API_URL,
    pay: serverEnv.PAY_API_URL,
    notifications: serverEnv.NOTIFICATIONS_API_URL,
}

/** What the APIs keep of a user agent (id-api: the sessions list). */
const USER_AGENT_MAX = 300

type BrowserContext = {
    ip?: string
    userAgent?: string
    requestId?: string
}

/** The browser behind this call; nothing outside a request (startup, build). */
async function browserContext(): Promise<BrowserContext> {
    try {
        const request = await requestHeaders()
        const requestId = request.get(REQUEST_ID_HEADER)
        return {
            ip: await clientIp(),
            userAgent: request.get('user-agent')?.slice(0, USER_AGENT_MAX) || undefined,
            // The proxy sets it for pages and actions; its own session refresh sees the raw header.
            requestId: requestId && requestIdFrom(requestId) === requestId ? requestId : undefined,
        }
    } catch (error) {
        unstable_rethrow(error)
        return {}
    }
}

export type BackendResult<T> = {
    ok: boolean
    status: number
    data: T | undefined
    /** `code` of the contract error body, or the first `details[].message`. */
    error?: string
}

/**
 * A server-side call to an API of the cluster: a 10 s budget, JSON in and
 * out, the access token when given. Of the browser's request only its
 * address (rate limits), user agent (sessions list) and request id (logs)
 * are forwarded; a failed call is logged.
 */
export async function backend<T>(
    service: Service,
    path: string,
    options: {
        method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
        token?: string
        body?: unknown
        idempotencyKey?: string
        clientIp?: string
    } = {},
): Promise<BackendResult<T>> {
    const method = options.method ?? 'GET'
    const browser = await browserContext()
    const headers: Record<string, string> = {
        accept: 'application/json',
    }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.token) headers.authorization = `Bearer ${options.token}`
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey
    const ip = options.clientIp ?? browser.ip
    if (ip) headers['x-forwarded-for'] = ip
    if (browser.userAgent) headers['user-agent'] = browser.userAgent
    if (browser.requestId) headers[REQUEST_ID_HEADER] = browser.requestId
    try {
        const response = await fetch(`${bases[service]}${path}`, {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: AbortSignal.timeout(10_000),
            cache: 'no-store',
        })
        const text = await response.text()
        const json = text ? (JSON.parse(text) as unknown) : undefined
        if (response.ok)
            return {
                ok: true,
                status: response.status,
                data: json as T,
            }
        const body = json as
            | {
                  code?: string
                  details?: {
                      message?: string
                  }[]
              }
            | undefined
        return {
            ok: false,
            status: response.status,
            data: undefined,
            error: body?.details?.[0]?.message ?? body?.code ?? `http_${response.status}`,
        }
    } catch (error) {
        // Without the query, the body or the headers: they may hold tokens or the email.
        // A network error is TypeError('fetch failed'); its cause says why (ECONNREFUSED, ...).
        const cause =
            error instanceof Error && error.cause instanceof Error ? (error.cause as NodeJS.ErrnoException) : undefined
        logger.error(
            {
                api: service,
                method,
                path: path.split('?')[0],
                requestId: browser.requestId,
                error: error instanceof Error ? error.name : typeof error,
                code: cause?.code,
            },
            'backend call failed',
        )
        return {
            ok: false,
            status: 503,
            data: undefined,
            error: 'unavailable',
        }
    }
}
