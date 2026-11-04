import { type Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('notFound')
    // Next.js marks 404 responses noindex itself.
    return {
        title: t('title'),
        description: t('body'),
    }
}

/** Unknown addresses and every notFound() call, in the reader's language. */
export default async function NotFound() {
    const t = await getTranslations('notFound')
    return (
        <section className="mx-auto grid max-w-xl gap-4 py-10 text-center">
            <p className="font-mono text-sm text-muted-foreground">404</p>
            <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('body')}</p>
            <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                    <Link href="/">{t('home')}</Link>
                </Button>
            </div>
        </section>
    )
}
