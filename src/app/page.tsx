import { redirect } from 'next/navigation'
import { currentSession } from '@/lib/session/current'

/** The account when signed in, the sign-in otherwise. */
export default async function Home() {
    redirect((await currentSession()) ? '/account' : '/login')
}
