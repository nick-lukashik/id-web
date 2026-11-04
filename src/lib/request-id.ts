export const REQUEST_ID_HEADER = 'x-request-id'

// An id from a trusted edge (ingress, load balancer) is kept so logs line up
// across services; anything else is replaced.
const SAFE_ID = /^[A-Za-z0-9._:-]{8,128}$/

export function requestIdFrom(incoming: string | null | undefined): string {
    return incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID()
}
