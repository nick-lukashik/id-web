'use client'

import { type Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/** The header's sections; only the browser knows which one is open. */
export function NavLinks({
    links,
}: {
    links: {
        href: Route
        label: string
    }[]
}) {
    const pathname = usePathname()
    const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

    return links.map(link => (
        <Link
            key={link.href}
            href={link.href}
            aria-current={isCurrent(link.href) ? 'page' : undefined}
            className={cn(
                'inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground',
                'aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:underline-offset-4',
            )}
        >
            {link.label}
        </Link>
    ))
}
