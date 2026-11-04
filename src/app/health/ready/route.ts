import { serverEnv } from '@/lib/env/server'

// Readiness (service contract, kind web): this server can render, so 200. A
// backend added later is reported in the body, never required: taking every
// web pod out of the load balancer would turn an API outage into a full site
// outage (see next-example).
export const dynamic = 'force-dynamic'

export function GET() {
    return Response.json(
        {
            status: 'ok',
            version: serverEnv.APP_VERSION,
        },
        {
            headers: {
                'cache-control': 'no-store',
            },
        },
    )
}
