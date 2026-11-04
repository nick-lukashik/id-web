import 'server-only'
import { headers } from 'next/headers'
import pino from 'pino'
import { serverEnv } from '@/lib/env/server'
import { REQUEST_ID_HEADER } from '@/lib/request-id'

/** JSON logs to stdout, one line per event; the platform ships them. */
export const logger = pino({
    level: serverEnv.LOG_LEVEL,
    base: {
        service: 'id-web',
        version: serverEnv.APP_VERSION,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: label => ({
            level: label,
        }),
    },
    redact: {
        paths: [
            'headers.cookie',
            'headers.authorization',
        ],
        censor: '[redacted]',
    },
})

/** Logger bound to the current request's id (set by src/proxy.ts). */
export async function requestLogger() {
    const requestId = (await headers()).get(REQUEST_ID_HEADER) ?? undefined
    return logger.child({
        requestId,
    })
}
