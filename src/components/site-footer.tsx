import { getTranslations } from 'next-intl/server'
import { AnalyticsSettings } from '@/components/analytics-consent'
import { serverEnv } from '@/lib/env/server'

export async function SiteFooter() {
    const t = await getTranslations('footer')
    return (
        <footer className="mt-16 border-t">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
                <p>
                    {t('version', {
                        version: serverEnv.APP_VERSION,
                    })}
                </p>
                <nav aria-label={t('links')}>
                    <ul className="flex flex-wrap gap-4">
                        <li>
                            <a
                                className="underline-offset-4 hover:underline"
                                href="/sitemap.xml"
                            >
                                sitemap.xml
                            </a>
                        </li>
                        <li>
                            <a
                                className="underline-offset-4 hover:underline"
                                href="/robots.txt"
                            >
                                robots.txt
                            </a>
                        </li>
                        <li>
                            <a
                                className="underline-offset-4 hover:underline"
                                href="/health/ready"
                            >
                                /health/ready
                            </a>
                        </li>
                        {serverEnv.GTM_ID ? (
                            <li>
                                <AnalyticsSettings />
                            </li>
                        ) : null}
                    </ul>
                </nav>
            </div>
        </footer>
    )
}
