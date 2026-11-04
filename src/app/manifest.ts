import { type MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'nick-lukashik ID',
        short_name: 'ID',
        description: 'Your nick-lukashik account: sign-in, wallet, payments and notifications.',
        start_url: '/',
        display: 'standalone',
        // The light palette in globals.css (--background).
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
            {
                src: '/icon',
                sizes: '64x64',
                type: 'image/png',
            },
            {
                src: '/apple-icon',
                sizes: '180x180',
                type: 'image/png',
            },
        ],
    }
}
