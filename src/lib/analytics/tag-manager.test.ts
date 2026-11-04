import { describe, expect, it } from 'vitest'
import { tagManagerScript } from './tag-manager'

describe('tagManagerScript', () => {
    const script = tagManagerScript('GTM-ABC1234')

    it('loads the container named by the id', () => {
        expect(script).toContain("'https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234'")
    })

    it('denies consent before the container can read it', () => {
        expect(script.indexOf("gtag('consent','default'")).toBeLessThan(script.indexOf('gtm.js?id='))
        expect(script).toContain("analytics_storage:'denied'")
        expect(script).toContain("ad_storage:'denied'")
    })
})
