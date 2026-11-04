import 'server-only'
import { type Route } from 'next'
import { z } from 'zod'
import { backend, type Service } from './backend'
import { type Page } from './types'

/** The most one list call returns (`limit` of wallet-api, pay-api and notifications-api; id-api ignores it). */
const API_LIMIT = 100
/** The most a list page shows, so `?show=` cannot ask for any number of calls. */
export const MAX_SHOWN = 1_000

/** How many items each list shows at first and adds with each "Show more". */
export const PAGE_SIZE = {
    payments: 20,
    notifications: 30,
    walletHistory: 20,
    /** id-api's own page: its sessions list has no `limit`. */
    sessions: 50,
} as const

/** How many items a list page shows: `?show=` (or the form field of that name), one page by default. */
export function shownParam(value: unknown, step: number): number {
    return z.coerce.number().int().min(step).max(MAX_SHOWN).catch(step).parse(value)
}

/** `path` showing `show` items: `?show=` only past the first page. */
export function withShown(path: string, show: number, step: number): Route {
    const url = new URL(path, 'http://id-web.local')
    if (show > step) url.searchParams.set('show', String(show))
    else url.searchParams.delete('show')
    return `${url.pathname}${url.search}` as Route
}

export type List<Item, Extra = object> = {
    /** The first page as the API sent it (`unreadCount` and the like); undefined: the list did not load. */
    first: (Page<Item> & Extra) | undefined
    /** The newest `show` items, or fewer if that is all there is (or all that loaded). */
    items: Item[]
    /** The API has more after the last item. */
    more: boolean
    /** A call after the first failed: `items` is what loaded before it. */
    incomplete: boolean
    /** Of the last call. */
    status: number
}

/**
 * The newest `show` items of a list API: calls of up to API_LIMIT, each
 * after the previous one's nextCursor, until there are enough or no more.
 * Every render starts from the newest, so an item that arrived since the
 * last "Show more" shifts the list by one instead of hiding one.
 */
export async function loadList<Item, Extra extends object = object>(
    service: Service,
    path: string,
    token: string,
    show: number,
): Promise<List<Item, Extra>> {
    let first: (Page<Item> & Extra) | undefined
    const items: Item[] = []
    let cursor: string | null = null
    do {
        const query = new URLSearchParams({
            limit: String(Math.min(API_LIMIT, show - items.length)),
        })
        if (cursor) query.set('cursor', cursor)
        const page = await backend<Page<Item> & Extra>(service, `${path}?${query}`, {
            token,
        })
        if (!page.ok || !page.data)
            return {
                first,
                items,
                more: cursor !== null,
                incomplete: first !== undefined,
                status: page.status,
            }
        first ??= page.data
        items.push(...page.data.items)
        // An empty page with a cursor would never end.
        cursor = page.data.items.length > 0 ? page.data.nextCursor : null
    } while (cursor && items.length < show)
    return {
        first,
        items,
        more: cursor !== null,
        incomplete: false,
        status: 200,
    }
}
