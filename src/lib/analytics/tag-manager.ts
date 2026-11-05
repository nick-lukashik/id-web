/**
 * Google Tag Manager, started on every visit. Browser code. Its script comes through
 * `'strict-dynamic'` in the CSP, being added by our own bundle, which carries the nonce.
 */
type Layered = Window & {
    dataLayer?: unknown[]
}

const layer = () => {
    const page = window as Layered
    page.dataLayer ??= []
    return page.dataLayer
}

/** Google takes a command as an Arguments object; an array is not one. */
function gtag(..._command: unknown[]) {
    // biome-ignore lint/complexity/noArguments: see above.
    layer().push(arguments)
}

let started = false

export function startTagManager(id: string) {
    if (started) return
    started = true
    gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
    })
    layer().push({
        'gtm.start': Date.now(),
        event: 'gtm.js',
    })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
    document.head.append(script)
}
