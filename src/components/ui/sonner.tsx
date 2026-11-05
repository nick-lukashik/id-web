'use client'

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// shadcn/ui's Toaster without next-themes: the site has one light theme.
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="light"
            className="toaster group"
            icons={{
                success: <CircleCheckIcon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <OctagonXIcon className="size-4" />,
                loading: <Loader2Icon className="size-4 animate-spin" />,
            }}
            // Applied in the browser only (toasts never render on the server), so
            // the CSP's style-src does not apply to it.
            style={
                {
                    '--normal-bg': 'var(--popover)',
                    '--normal-text': 'var(--popover-foreground)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': 'var(--radius)',
                } as React.CSSProperties
            }
            toastOptions={{
                ...toastOptions,
                classNames: {
                    toast: 'cn-toast',
                    ...toastOptions?.classNames,
                },
            }}
            {...props}
        />
    )
}

export { Toaster }
