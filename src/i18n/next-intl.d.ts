import type { AppLocale } from './config'
import type messages from './messages/en.json'

// Typed locales and message keys for useTranslations/getTranslations.
declare module 'next-intl' {
    // biome-ignore lint/style/useConsistentTypeDefinitions: augmentation must merge into next-intl's AppConfig interface.
    interface AppConfig {
        Locale: AppLocale
        Messages: typeof messages
    }
}
