import { ImageResponse } from 'next/og'
import en from '@/i18n/messages/en.json'

export const alt = en.meta.ogAlt
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = 'image/png'

/**
 * Share card for every page (Next.js also uses it for twitter:image), drawn
 * once at build time. Link previews send no locale cookie, so it is English.
 */
export default function OpengraphImage() {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 80,
                // The site's palette (globals.css, Mono Brutal): black, white, muted text, the green signal.
                background: '#000000',
                color: '#ffffff',
                border: '2px solid #ffffff',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                }}
            >
                <div
                    style={{
                        width: 72,
                        height: 72,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #ffffff',
                        color: '#ffffff',
                        fontSize: 44,
                        fontWeight: 700,
                    }}
                >
                    NL
                </div>
                <div
                    style={{
                        fontSize: 32,
                        letterSpacing: 6,
                        textTransform: 'uppercase',
                    }}
                >
                    {en.meta.siteName}
                </div>
                <div
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        background: '#b9ff3d',
                    }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                }}
            >
                <div
                    style={{
                        fontSize: 84,
                        fontWeight: 800,
                        lineHeight: 1,
                        textTransform: 'uppercase',
                    }}
                >
                    {en.meta.ogTitle}
                </div>
                <div
                    style={{
                        fontSize: 30,
                        color: '#a3a3a3',
                    }}
                >
                    {en.meta.ogTagline}
                </div>
            </div>
        </div>,
        size,
    )
}
