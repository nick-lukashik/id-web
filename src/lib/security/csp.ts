export const NONCE_HEADER = 'x-nonce'

export type CspOptions = {
    nonce: string
    /** `next dev`: React needs eval for error overlays, HMR needs a websocket. */
    dev?: boolean
    /** Served over TLS (directly or behind a proxy): upgrade stray http URLs. */
    https?: boolean
}

/**
 * Inline stylesheets allowed by hash, for a library that injects a <style>
 * element without a nonce. None here; next-example allows Sonner's (toasts)
 * this way and tests the hash against node_modules.
 */
export const STYLE_HASHES: string[] = []

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
    return btoa(crypto.randomUUID())
}

/**
 * Strict CSP: scripts and style tags run only with this response's nonce
 * (Next.js applies it to its own tags) or, for styles, a known hash; the
 * browser talks to this origin only (an API is proxied under /api). Dev
 * relaxes styles because the dev overlay injects them without a nonce.
 */
export function buildCsp({ nonce, dev = false, https = false }: CspOptions): string {
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
        ],
        'font-src': [
            "'self'",
        ],
        'connect-src': [
            "'self'",
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
        ],
        'frame-ancestors': [
            "'none'",
        ],
    }
    const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`)
    if (https) policy.push('upgrade-insecure-requests')
    return policy.join('; ')
}
