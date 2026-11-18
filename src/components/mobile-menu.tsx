'use client'

import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'

/**
 * The sections and sign-out on a narrow screen: a native disclosure, so it opens
 * without JavaScript too. Keyed by the path: a new page starts with it closed.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
    const pathname = usePathname()
    return (
        <details
            key={pathname}
            className="group relative min-[900px]:hidden"
        >
            <summary className="label inline-flex h-11 cursor-pointer list-none items-center px-2 text-muted-foreground group-open:text-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                {label}
            </summary>
            <div className="absolute top-full right-0 z-40 mt-2.5 flex w-60 flex-col border border-foreground bg-background p-2">
                {children}
            </div>
        </details>
    )
}
