// Static security headers for every response (next.config.ts). The CSP is per
// request (it carries a nonce), so src/proxy.ts sets it.
// No path aliases here: next.config.ts imports this file directly.

const permissions = [
    'accelerometer=()',
    'autoplay=()',
    'bluetooth=()',
    'browsing-topics=()',
    'camera=()',
    'display-capture=()',
    'geolocation=()',
    'gyroscope=()',
    'hid=()',
    'idle-detection=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'serial=()',
    'usb=()',
    'xr-spatial-tracking=()',
].join(', ')

export const securityHeaders = [
    // Browsers ignore HSTS over plain http, so it is safe on localhost too.
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
    },
    {
        key: 'Cross-Origin-Resource-Policy',
        value: 'same-site',
    },
    {
        key: 'Origin-Agent-Cluster',
        value: '?1',
    },
    {
        key: 'X-DNS-Prefetch-Control',
        value: 'off',
    },
    {
        key: 'X-Permitted-Cross-Domain-Policies',
        value: 'none',
    },
    {
        key: 'Permissions-Policy',
        value: permissions,
    },
]
