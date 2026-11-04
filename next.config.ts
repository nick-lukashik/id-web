import { type NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { securityHeaders } from './src/lib/security/headers'

const config: NextConfig = {
    // A self-contained server.js with only the traced dependencies (Dockerfile).
    output: 'standalone',
    reactCompiler: true,
    typedRoutes: true,
    poweredByHeader: false,
    experimental: {
        // The language switch (src/i18n/actions.ts) is the only Server Action;
        // its body stays within the 1 MiB request limit of the service contract.
        serverActions: {
            bodySizeLimit: '1mb',
        },
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ]
    },
}

// Finds the request config at ./src/i18n/request.ts.
export default createNextIntlPlugin()(config)
