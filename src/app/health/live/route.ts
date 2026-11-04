import { serverEnv } from '@/lib/env/server'

// Liveness: the process answers. Reading the env here fails the probe on a
// bad configuration before any page does.
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
