import { ImageResponse } from 'next/og'

/** The app mark ("N" on the primary colour, --primary in globals.css), drawn at any square size. */
export function mark(size: number) {
    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#171717',
                color: '#ffffff',
                fontSize: size * 0.62,
                fontWeight: 700,
                borderRadius: size * 0.2,
            }}
        >
            N
        </div>,
        {
            width: size,
            height: size,
        },
    )
}
