/**
 * Google Tag Manager, started on the first visit unless the person turned it
 * off. Browser code. Its script comes through `'strict-dynamic'` in the CSP, being
 * added by our own bundle, which carries the nonce.
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

let state: 'off' | 'on' | 'stopped' = 'off'

export function startTagManager(id: string) {
    if (state === 'on') return
    if (state === 'stopped') {
        gtag('consent', 'update', {
            analytics_storage: 'granted',
        })
        state = 'on'
        return
    }
    state = 'on'
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

/** Turned off: this page sends no more, and Google's cookies go, on whichever domain they were set. */
export function stopTagManager() {
    if (state === 'on') {
        gtag('consent', 'update', {
            analytics_storage: 'denied',
        })
        state = 'stopped'
    }
    const labels = location.hostname.split('.')
    const domains = labels.map((_, index) => `; Domain=${labels.slice(index).join('.')}`)
    for (const cookie of document.cookie.split('; ')) {
        const name = cookie.split('=')[0] ?? ''
        if (name !== '_ga' && !name.startsWith('_ga_')) continue
        for (const domain of [
            '',
            ...domains,
        ]) {
            // biome-ignore lint/suspicious/noDocumentCookie: Google's cookies are set from the page, so only the page can drop them.
            document.cookie = `${name}=; Max-Age=0; Path=/${domain}`
        }
    }
}
