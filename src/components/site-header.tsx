import { type Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { signOut } from '@/app/actions/account'
import { type AppLocale } from '@/i18n/config'
import { serverEnv } from '@/lib/env/server'
import { LocaleSwitch } from './locale-switch'
import { NavLinks } from './nav-links'

const links = [
    {
        href: '/account',
        label: 'account',
    },
    {
        href: '/wallet',
        label: 'wallet',
    },
    {
        href: '/payments',
        label: 'payments',
    },
    {
        href: '/notifications',
        label: 'notifications',
    },
] as const

/** The header of nick-lukashik.com: the NL mark and the site's name, the sections, the language and sign-out. */
export function SiteHeader({
    languageNames,
    signedIn,
}: {
    languageNames: Record<AppLocale, string>
    signedIn: boolean
}) {
    const t = useTranslations('nav')

    return (
        <header className="sticky top-0 z-30 border-b border-foreground bg-background">
            <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-6">
                <Link
                    href={(signedIn ? '/account' : '/login') as Route}
                    className="flex h-16 items-center gap-3.5"
                >
                    <span
                        aria-hidden="true"
                        className="font-display text-2xl leading-none font-bold"
                    >
                        NL
                    </span>
                    <span className="label sr-only text-[0.6875rem] tracking-[0.2em] text-muted-foreground sm:not-sr-only">
                        {t('brand')}
                    </span>
                </Link>
                {signedIn ? (
                    <nav
                        aria-label={t('label')}
                        // Below 980px the sections take a row of their own under the mark, scrolling sideways if they must.
                        className="order-last -mx-5 flex w-[calc(100%+2.5rem)] items-center gap-x-3 overflow-x-auto border-t border-line px-3 whitespace-nowrap sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-6 min-[980px]:order-none min-[980px]:mx-0 min-[980px]:w-auto min-[980px]:overflow-visible min-[980px]:border-t-0 min-[980px]:px-0"
                    >
                        <NavLinks
                            links={links
                                // Payments only where pay-api runs.
                                .filter(link => link.href !== '/payments' || serverEnv.PAYMENTS_ENABLED)
                                .map(link => ({
                                    href: link.href,
                                    label: t(link.label),
                                }))}
                        />
                    </nav>
                ) : null}
                <div className="flex h-16 items-center gap-1">
                    <LocaleSwitch names={languageNames} />
                    {signedIn ? (
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="label inline-flex h-11 items-center px-2 text-muted-foreground hover:text-foreground"
                            >
                                {t('signOut')}
                            </button>
                        </form>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
