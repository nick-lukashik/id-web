import { type Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { PRIVATE_PAGE } from '@/lib/seo/robots'
import { siteReturn } from '@/lib/session/continue'

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('logout')
    return {
        title: t('title'),
        robots: PRIVATE_PAGE,
    }
}

/** Sign-out asked for by a page outside the platform: one button, so nothing happens without the person. */
export default async function LogoutConfirmPage({ searchParams }: PageProps<'/logout/confirm'>) {
    const t = await getTranslations('logout')
    const back = siteReturn((await searchParams).return)
    return (
        <div className="mx-auto flex max-w-md flex-col items-start gap-4">
            <h1 className="text-xl font-semibold">{t('heading')}</h1>
            <p>{t('lead')}</p>
            <form
                action={back ? `/logout?return=${encodeURIComponent(back)}` : '/logout'}
                method="post"
            >
                <Button type="submit">{t('confirm')}</Button>
            </form>
        </div>
    )
}
