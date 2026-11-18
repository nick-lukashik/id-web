import localFont from 'next/font/local'

// The kit's two families (the same @fontsource files), through next/font: the
// Latin files are preloaded with the page, and a fallback sized to the real
// font holds the layout until they arrive. Cyrillic is a face of its own per
// family, loaded only when a Russian page needs it; its adjusted fallback
// stands in for both. next/font reads these options at build time, so they
// are literals.

export const monoLatin = localFont({
    src: [
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-latin-400-normal.woff2',
            weight: '400',
        },
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-latin-500-normal.woff2',
            weight: '500',
        },
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-latin-700-normal.woff2',
            weight: '700',
        },
    ],
    declarations: [
        {
            prop: 'unicode-range',
            value: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
        },
    ],
    adjustFontFallback: false,
    variable: '--font-mono-latin',
})

export const monoCyrillic = localFont({
    src: [
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-cyrillic-400-normal.woff2',
            weight: '400',
        },
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-cyrillic-500-normal.woff2',
            weight: '500',
        },
        {
            path: '../../node_modules/@fontsource/martian-mono/files/martian-mono-cyrillic-700-normal.woff2',
            weight: '700',
        },
    ],
    declarations: [
        {
            prop: 'unicode-range',
            value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
        },
    ],
    preload: false,
    variable: '--font-mono-cyrillic',
})

export const condensedLatin = localFont({
    src: [
        {
            path: '../../node_modules/@fontsource/sofia-sans-extra-condensed/files/sofia-sans-extra-condensed-latin-700-normal.woff2',
            weight: '700',
        },
        {
            path: '../../node_modules/@fontsource/sofia-sans-extra-condensed/files/sofia-sans-extra-condensed-latin-800-normal.woff2',
            weight: '800',
        },
    ],
    declarations: [
        {
            prop: 'unicode-range',
            value: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
        },
    ],
    adjustFontFallback: false,
    variable: '--font-condensed-latin',
})

export const condensedCyrillic = localFont({
    src: [
        {
            path: '../../node_modules/@fontsource/sofia-sans-extra-condensed/files/sofia-sans-extra-condensed-cyrillic-700-normal.woff2',
            weight: '700',
        },
        {
            path: '../../node_modules/@fontsource/sofia-sans-extra-condensed/files/sofia-sans-extra-condensed-cyrillic-800-normal.woff2',
            weight: '800',
        },
    ],
    declarations: [
        {
            prop: 'unicode-range',
            value: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
        },
    ],
    preload: false,
    variable: '--font-condensed-cyrillic',
})

export const fontVariables = [
    monoLatin,
    monoCyrillic,
    condensedLatin,
    condensedCyrillic,
]
    .map(font => font.variable)
    .join(' ')
