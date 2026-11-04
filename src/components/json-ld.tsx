type JsonLdProps = {
    data: Record<string, unknown>
    nonce?: string
}

/**
 * Structured data for search engines. `<` is escaped so a value can never
 * close the script tag; the nonce keeps it valid under the strict CSP.
 */
export function JsonLd({ data, nonce }: JsonLdProps) {
    return (
        <script
            type="application/ld+json"
            nonce={nonce}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON with `<` escaped, see above.
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, '\\u003c'),
            }}
        />
    )
}
