import { type MetadataRoute } from 'next'
import { serverEnv } from '@/lib/env/server'
import { buildRobots } from '@/lib/seo/robots'

// Per request: ROBOTS and SITE_URL are runtime configuration.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
    return buildRobots(serverEnv.ROBOTS, serverEnv.SITE_URL)
}
