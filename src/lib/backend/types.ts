/** Response shapes of the APIs that id-web renders (their OpenAPI is the source). */

export type Currency = 'RUB' | 'USD' | 'EUR'
export const CURRENCIES: readonly Currency[] = [
    'RUB',
    'USD',
    'EUR',
]

export type Page<T> = {
    items: T[]
    nextCursor: string | null
}

export type Wallet = {
    unit: 'COIN'
    balance: string
    state: 'active' | 'restricted'
    exists: boolean
    updatedAt: string | null
}

export type WalletTx = {
    id: string
    kind: 'credit' | 'debit' | 'grant' | 'adjust'
    source: string
    amount: string
    balanceBefore: string
    balanceAfter: string
    createdAt: string
}

export type Product = {
    key: string
    coins: string
    title: {
        en: string
        ru: string
    }
    prices: Record<Currency, string>
}

export type Payment = {
    id: string
    productKey: string
    coins: string
    amount: string
    currency: Currency
    provider: string
    /**
     * `creating`: another request with the same key is making the provider's
     * checkout; no URL yet. `failed` covers a checkout whose answer was lost too.
     */
    status: 'created' | 'creating' | 'pending' | 'succeeded' | 'failed'
    checkoutUrl: string | null
    paidAt: string | null
    createdAt: string
}

export type Notification = {
    id: string
    kind: 'wallet.credited' | 'welcome'
    params: Record<string, string>
    read: boolean
    createdAt: string
}
