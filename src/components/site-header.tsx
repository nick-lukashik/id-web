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

export function SiteHeader({
    languageNames,
    signedIn,
}: {
    languageNames: Record<AppLocale, string>
    signedIn: boolean
}) {
    const t = useTranslations('nav')

    return (
        <header className="border-b bg-background">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
                <nav
                    aria-label={t('label')}
                    className="flex flex-wrap items-center gap-1"
                >
                    {signedIn ? (
                        <NavLinks
                            links={links
                                // Payments only where pay-api runs.
                                .filter(link => link.href !== '/payments' || serverEnv.PAYMENTS_ENABLED)
                                .map(link => ({
                                    href: link.href,
                                    label: t(link.label),
                                }))}
                        />
                    ) : (
                        <span className="inline-flex h-11 items-center px-3 text-sm font-medium">{t('brand')}</span>
                    )}
                </nav>
                <div className="flex items-center gap-2">
                    <LocaleSwitch names={languageNames} />
                    {signedIn ? (
                        <form action={signOut}>
                            <button
                                type="submit"
                                className="inline-flex h-9 items-center rounded-md px-2.5 text-sm text-muted-foreground hover:text-foreground"
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
