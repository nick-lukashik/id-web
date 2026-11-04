import { cn } from 'cn'
import type * as React from 'react'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
    return (
        // biome-ignore lint/a11y/noLabelWithoutControl: callers pass htmlFor
        <label
            data-slot="label"
            className={cn('flex items-center gap-2 text-sm leading-none font-medium select-none', className)}
            {...props}
        />
    )
}

export { Label }
