/**
 * Google Tag Manager, started on every visit (its script after the page has loaded). Browser code. Its script comes through
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
    // The container itself waits until the page has loaded and the browser is
    // idle: its script is a long task that would otherwise compete with the
    // page's own. What is pushed above is read when it arrives.
    const load = () => {
        const script = document.createElement('script')
        script.async = true
        script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
        document.head.append(script)
    }
    const idle = () =>
        'requestIdleCallback' in window
            ? requestIdleCallback(load, {
                  timeout: 3000,
              })
            : setTimeout(load, 1)
    if (document.readyState === 'complete') idle()
    else
        addEventListener('load', idle, {
            once: true,
        })
}
