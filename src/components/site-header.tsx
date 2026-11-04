'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signOut } from '@/app/actions/account'
import { type AppLocale } from '@/i18n/config'
import { cn } from '@/lib/utils'
import { LocaleSwitch } from './locale-switch'

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
    const pathname = usePathname()
    const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

    return (
        <header className="border-b bg-background">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
                <nav
                    aria-label={t('label')}
                    className="flex flex-wrap items-center gap-1"
                >
                    {signedIn ? (
                        links.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={isCurrent(link.href) ? 'page' : undefined}
                                className={cn(
                                    'inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                                    'aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4',
                                )}
                            >
                                {t(link.label)}
                            </Link>
                        ))
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
