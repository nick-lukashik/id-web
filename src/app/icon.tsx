import { mark } from '@/lib/seo/mark'

export const size = {
    width: 64,
    height: 64,
}
export const contentType = 'image/png'

/** Tab, bookmark and search-result icon, drawn at build time. */
export default function Icon() {
    return mark(size.width)
}
