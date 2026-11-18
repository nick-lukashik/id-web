import { type Route } from 'next'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { signOut } from '@/app/actions/account'
import { type AppLocale } from '@/i18n/config'
import { serverEnv } from '@/lib/env/server'
import { LocaleSwitch } from './locale-switch'
import { MobileMenu } from './mobile-menu'
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

const quiet = 'label inline-flex h-11 items-center px-2 text-muted-foreground hover:text-foreground'

/** The header of nick-lukashik.com: the NL mark and the site's name, the sections, the language and sign-out. */
export function SiteHeader({
    languageNames,
    signedIn,
}: {
    languageNames: Record<AppLocale, string>
    signedIn: boolean
}) {
    const t = useTranslations('nav')
    // Payments only where pay-api runs.
    const sections = links
        .filter(link => link.href !== '/payments' || serverEnv.PAYMENTS_ENABLED)
        .map(link => ({
            href: link.href,
            label: t(link.label),
        }))

    return (
        <header className="sticky top-0 z-30 border-b border-foreground bg-background">
            <div className="wrap flex h-16 items-center gap-6">
                <Link
                    href={(signedIn ? '/account' : '/login') as Route}
                    className="flex h-16 shrink-0 items-center gap-3.5"
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
                        // From 900px the sections sit in the row; below, in the menu.
                        className="hidden min-w-0 flex-1 items-center gap-x-3 whitespace-nowrap min-[900px]:flex"
                    >
                        <NavLinks links={sections} />
                    </nav>
                ) : null}
                <div className="ml-auto flex h-16 shrink-0 items-center gap-1">
                    <LocaleSwitch names={languageNames} />
                    {signedIn ? (
                        <>
                            <form
                                action={signOut}
                                className="hidden min-[900px]:block"
                            >
                                <button
                                    type="submit"
                                    className={quiet}
                                >
                                    {t('signOut')}
                                </button>
                            </form>
                            <MobileMenu label={t('menu')}>
                                <nav
                                    aria-label={t('label')}
                                    className="flex flex-col"
                                >
                                    <NavLinks links={sections} />
                                </nav>
                                <form
                                    action={signOut}
                                    className="mt-1 border-t border-line pt-1"
                                >
                                    <button
                                        type="submit"
                                        className={quiet}
                                    >
                                        {t('signOut')}
                                    </button>
                                </form>
                            </MobileMenu>
                        </>
                    ) : null}
                </div>
            </div>
        </header>
    )
}
