import 'server-only'
import { z } from 'zod'

const blankAsMissing = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)
const unsetIfBlank = <T extends z.ZodType>(schema: T) => z.preprocess(blankAsMissing, schema)
/** `next build` evaluates route modules too; the image is built without secrets. */
const building = process.env.NEXT_PHASE === 'phase-production-build'

/**
 * Server-only configuration, read at runtime (one image for every
 * environment). Parsed on first import: instrumentation.ts imports it at
 * startup, so a bad value stops the server instead of failing every page.
 */
const schema = z
    .object({
        /** Public origin of this site: canonical URLs, sitemap, Open Graph. */
        SITE_URL: unsetIfBlank(z.url().default('http://localhost:3000')),
        /** Build or release identifier, sent as x-app-version. */
        APP_VERSION: unsetIfBlank(z.string().max(64).default('dev')),
        LOG_LEVEL: unsetIfBlank(
            z
                .enum([
                    'fatal',
                    'error',
                    'warn',
                    'info',
                    'debug',
                    'trace',
                    'silent',
                ])
                .default('info'),
        ),
        /** Backends inside the cluster (http://<api>.prod.svc); only this server calls them. */
        ID_API_URL: unsetIfBlank(z.url().default('http://id-api.prod.svc')),
        WALLET_API_URL: unsetIfBlank(z.url().default('http://wallet-api.prod.svc')),
        PAY_API_URL: unsetIfBlank(z.url().default('http://pay-api.prod.svc')),
        NOTIFICATIONS_API_URL: unsetIfBlank(z.url().default('http://notifications-api.prod.svc')),
        /** Key of the sealed session cookie (AES-256-GCM), shared by the replicas. */
        SESSION_SECRET: building ? z.string().default('') : z.string().min(32, 'at least 32 characters'),
        /**
         * Other origins a form here may end up on, space-separated: the apps that
         * sign in through this site (their /auth/callback) and the payment
         * provider's checkout. Browsers apply CSP form-action to the redirects
         * after a form too, so without them a sign-in or a payment started
         * before JavaScript loads would stop at the redirect.
         */
        FORM_ACTION_ORIGINS: unsetIfBlank(
            z
                .string()
                .default('https://nick-lukashik.com')
                .transform(value => value.split(/[\s,]+/).filter(Boolean))
                .pipe(z.array(z.url().transform(url => new URL(url).origin))),
        ),
        /** `noindex` (stage): robots.txt disallows everything, pages say noindex. */
        /** Google Tag Manager container (GTM-ABC1234). Unset: no tag manager, and the CSP stays on this origin. */
        GTM_ID: unsetIfBlank(
            z
                .string()
                .regex(/^GTM-[A-Z0-9]{4,12}$/, 'a container id like GTM-ABC1234')
                .optional(),
        ),
        ROBOTS: unsetIfBlank(
            z
                .enum([
                    'index',
                    'noindex',
                ])
                .default('index'),
        ),
        /**
         * Coin packs and the payment pages, for an environment where pay-api
         * runs. Off: no payments link, no top-up, /payments answers 404.
         */
        PAYMENTS_ENABLED: unsetIfBlank(z.stringbool().default(false)),
    })
    .transform(env => ({
        ...env,
        SITE_URL: env.SITE_URL.replace(/\/+$/, ''),
    }))

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${z.prettifyError(parsed.error)}`)
}
export const serverEnv = parsed.data
