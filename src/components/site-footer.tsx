import { getTranslations } from 'next-intl/server'
import { serverEnv } from '@/lib/env/server'
import { legalLinks } from '@/lib/legal/links'

const link = 'label hover:text-foreground'

/** The footer of nick-lukashik.com: the site's name and the legal texts (they live on the main site). */
export async function SiteFooter() {
    const [t, meta] = await Promise.all([
        getTranslations('footer'),
        getTranslations('meta'),
    ])
    const legal = legalLinks(serverEnv.SITE_URL)
    return (
        <footer className="mt-20 border-t border-foreground">
            <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-7 text-muted-foreground">
                <p className="label">{meta('siteName')}</p>
                <nav aria-label={t('links')}>
                    <ul className="flex flex-wrap gap-5">
                        <li>
                            <a
                                className={link}
                                href={legal.privacy}
                            >
                                {t('privacy')}
                            </a>
                        </li>
                        <li>
                            <a
                                className={link}
                                href={legal.terms}
                            >
                                {t('terms')}
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
        </footer>
    )
}
