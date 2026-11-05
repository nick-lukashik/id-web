export const NONCE_HEADER = 'x-nonce'

export type CspOptions = {
    nonce: string
    /** `next dev`: React needs eval for error overlays, HMR needs a websocket. */
    dev?: boolean
    /** Served over TLS (directly or behind a proxy): upgrade stray http URLs. */
    https?: boolean
    /** Origins a form may lead to besides this one (FORM_ACTION_ORIGINS). */
    formActions?: readonly string[]
    /** Google Tag Manager is on (GTM_ID): Google Analytics may receive what it sends. */
    analytics?: boolean
}

/** Where Tag Manager and Google Analytics send data. Their scripts need no entry: `'strict-dynamic'`. */
const ANALYTICS_HOSTS = [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
]

/**
 * Inline stylesheets allowed by hash. Sonner (the toasts) injects its CSS at
 * runtime as a <style> element, which cannot take a nonce: it appends the
 * element empty, then adds the text. So the empty stylesheet and Sonner's exact
 * stylesheet are allowed instead of 'unsafe-inline'. csp.test.ts recomputes
 * the second hash from node_modules/sonner and fails when an update changes it.
 */
export const STYLE_HASHES = [
    // "" (the empty <style> before Sonner fills it)
    "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    // sonner 2.0.8 dist/index.mjs __insertCSS(...)
    "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='",
]

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
    return btoa(crypto.randomUUID())
}

/**
 * Strict CSP: scripts and style tags run only with this response's nonce
 * (Next.js applies it to its own tags) or, for styles, a known hash; the
 * browser talks to this origin only (an API is proxied under /api; Google's
 * hosts are added with GTM_ID). Dev
 * relaxes styles because the dev overlay injects them without a nonce.
 */
export function buildCsp({
    nonce,
    dev = false,
    https = false,
    formActions = [],
    analytics = false,
}: CspOptions): string {
    const directives: Record<string, string[]> = {
        'default-src': [
            "'self'",
        ],
        'script-src': [
            "'self'",
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            ...(dev
                ? [
                      "'unsafe-eval'",
                  ]
                : []),
        ],
        // A nonce disables 'unsafe-inline', so dev gets 'unsafe-inline' without one.
        'style-src': dev
            ? [
                  "'self'",
                  "'unsafe-inline'",
              ]
            : [
                  "'self'",
                  `'nonce-${nonce}'`,
                  ...STYLE_HASHES,
              ],
        'img-src': [
            "'self'",
            'data:',
            'blob:',
            ...(analytics ? ANALYTICS_HOSTS : []),
        ],
        'font-src': [
            "'self'",
        ],
        'connect-src': [
            "'self'",
            ...(analytics ? ANALYTICS_HOSTS : []),
            ...(dev
                ? [
                      'ws:',
                      'wss:',
                  ]
                : []),
        ],
        'manifest-src': [
            "'self'",
        ],
        'worker-src': [
            "'self'",
            'blob:',
        ],
        'frame-src': [
            "'none'",
        ],
        'object-src': [
            "'none'",
        ],
        'base-uri': [
            "'none'",
        ],
        'form-action': [
            "'self'",
            ...formActions,
        ],
        'frame-ancestors': [
            "'none'",
        ],
    }
    const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
    if (https) policy.push('upgrade-insecure-requests')
    return policy.join('; ')
}
