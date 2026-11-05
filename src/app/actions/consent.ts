'use server'

import { cookies } from 'next/headers'
import { CONSENT_COOKIE, consentCookieOptions } from '@/lib/analytics/consent'
import { serverEnv } from '@/lib/env/server'

/** The person's answer about statistics. On the server: a cookie set from the page would last seven days in Safari. */
export async function saveConsent(granted: boolean) {
    ;(await cookies()).set(
        CONSENT_COOKIE,
        granted === true ? 'granted' : 'denied',
        consentCookieOptions(serverEnv.SITE_URL),
    )
}
