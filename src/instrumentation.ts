import { type Instrumentation } from 'next'

/** Runs once per server start: validate the env early and log the start. */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    const [{ serverEnv }, { logger }] = await Promise.all([
        import('@/lib/env/server'),
        import('@/lib/logger'),
    ])
    logger.info(
        {
            siteUrl: serverEnv.SITE_URL,
        },
        'server started',
    )
}

/** Every server-side error (render, route, action, proxy) as one JSON line. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    const { logger } = await import('@/lib/logger')
    const header = request.headers['x-request-id']
    logger.error(
        {
            err: error,
            requestId: Array.isArray(header) ? header[0] : header,
            method: request.method,
            path: request.path,
            route: context.routePath,
            routeType: context.routeType,
        },
        'request error',
    )
}
