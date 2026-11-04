import 'server-only'
import { serverEnv } from '@/lib/env/server'

export type Service = 'id' | 'wallet' | 'pay' | 'notifications'

const bases: Record<Service, string> = {
    id: serverEnv.ID_API_URL,
    wallet: serverEnv.WALLET_API_URL,
    pay: serverEnv.PAY_API_URL,
    notifications: serverEnv.NOTIFICATIONS_API_URL,
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
 * out, the access token when given, the client address for rate limits.
 * Nothing the browser sent is forwarded.
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
    const headers: Record<string, string> = {
        accept: 'application/json',
    }
    if (options.body !== undefined) headers['content-type'] = 'application/json'
    if (options.token) headers.authorization = `Bearer ${options.token}`
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey
    if (options.clientIp) headers['x-forwarded-for'] = options.clientIp
    try {
        const response = await fetch(`${bases[service]}${path}`, {
            method: options.method ?? 'GET',
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
    } catch {
        return {
            ok: false,
            status: 503,
            data: undefined,
            error: 'unavailable',
        }
    }
}
