import { ImageResponse } from 'next/og'

/** The app mark: "NL" in white on black (Mono Brutal), drawn at any square size. */
export function mark(size: number) {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000000',
                color: '#ffffff',
                fontSize: size * 0.5,
                fontWeight: 800,
                letterSpacing: -size * 0.02,
            }}
        >
            NL
        </div>,
        {
            width: size,
            height: size,
        },
    )
}
