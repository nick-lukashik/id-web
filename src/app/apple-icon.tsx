import { mark } from '@/lib/seo/mark'

export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

/** iOS home-screen icon, drawn at build time. */
export default function AppleIcon() {
    return mark(size.width)
}
