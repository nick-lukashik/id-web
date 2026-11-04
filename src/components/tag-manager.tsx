import { tagManagerScript } from '@/lib/analytics/tag-manager'

type TagManagerProps = {
    /** GTM_ID; without it nothing is rendered and the CSP stays on this origin. */
    id?: string
    nonce?: string
}

export function TagManager({ id, nonce }: TagManagerProps) {
    if (!id) return null
    return (
        <script
            nonce={nonce}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: our own snippet; the id is checked by the env schema.
            dangerouslySetInnerHTML={{
                __html: tagManagerScript(id),
            }}
        />
    )
}
