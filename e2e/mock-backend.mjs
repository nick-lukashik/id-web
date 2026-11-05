// The four APIs id-web calls, in memory, for the e2e suite only: the routes
// and response shapes of id-api, wallet-api, pay-api and notifications-api,
// none of their rules beyond what the pages need. Every sign-in code is
// SIGN_IN_CODE (e2e/servers.ts); each test signs in with its own email.
// Asking for a code by email prefix: `undeliverable-` gets deliveryStatus
// `failed`, `resend-` a three-second cooldown, `limited-` the 429 of id-api's
// limiter (with the wait), `throttled-` a 429 without a wait.
// `verify-limited-` gets that limiter's 429 on step 2 instead.
// A checkout by email prefix: `creating-` stays `creating` until POST
// /payments/created, `lost-` is `failed` (pay-api lost the provider's answer).
// GET /calls counts the refreshes and lists their request ids (e2e of the
// proxy's refresh); GET /challenges?email= lists the challenges issued and
// used for an email.
// POST /seed gives a user payments, notifications, wallet operations, other
// devices and passkeys in bulk (the lists' "Show more"); POST /faults makes
// one API route of one user answer a status, optionally only for a matching
// query (DELETE /faults clears that user's), so a spec sees id-web's states.
// Google: GET /google/authorize plays Google's page. It answers with the
// account or the error of the `google_answer` cookie the test set for this
// host (`email:<address>` or `error:<code>`); a code `google:<email>` stands
// for a verified Google account with that email. APP_CALLBACK's origin gets
// a stand-in app that answers any page. Passkeys: the mock keeps
// the credential ids the browser registered and accepts them back; it checks
// no signature (id-api's integration tests do).
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 3190)
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100'
/** The one app that signs in here: a stand-in for nick-lukashik.com. */
const APP_CALLBACK = process.env.APP_CALLBACK ?? 'http://localhost:3300/auth/callback'
const CODE = '123456'
const ACCESS_TTL_MS = 5 * 60_000
/** Emails starting with `short-` get 30 s tokens: under id-web's 60 s refresh margin. */
/** Emails starting with `expired-` get tokens already past: a page sees one when no refresh can succeed. */
const EXPIRED_TTL_MS = -1_000
const SHORT_TTL_MS = 30_000
/** As id-api: one code per email a minute; `resend-` emails wait three seconds. */
const RESEND_COOLDOWN_MS = 60_000
const SHORT_COOLDOWN_MS = 3_000
/** The wait the limiter names for `limited-` and `verify-limited-` emails. */
const LIMITED_WAIT_MS = 42_000
/** As id-api: its sessions list has a fixed page and no `limit`. */
const SESSIONS_PAGE = 50

const users = new Map() // id -> { id, email, displayName, locale, roles, balance, tx[], notifications[] }
const byEmail = new Map() // email -> id
const challenges = new Map() // challengeId -> email
const codesSent = new Map() // email -> { issued: challengeId[], used: challengeId[] }
const ttlOf = email =>
    email.startsWith('expired-') ? EXPIRED_TTL_MS : email.startsWith('short-') ? SHORT_TTL_MS : ACCESS_TTL_MS
const sessions = new Map() // sessionId -> { id, userId, refreshToken, userAgent, lastActiveAt, revoked }
const tokens = new Map() // accessToken -> sessionId
const googleLinks = new Map() // google email -> userId
const passkeys = new Map() // credentialId -> { id, userId, name, createdAt, lastUsedAt }
const passkeyChallenges = new Set()
const payments = new Map() // id -> payment
const faults = [] // { email, method, path: RegExp, query: RegExp | undefined, status }
const calls = {
    refresh: 0,
    refreshRequestIds: [],
}

const catalog = [
    {
        key: 'coins-100',
        coins: '100',
        title: {
            en: '100 coins',
            ru: '100 монет',
        },
        prices: {
            RUB: '100',
            USD: '1',
            EUR: '1',
        },
    },
    {
        key: 'coins-550',
        coins: '550',
        title: {
            en: '550 coins (+10%)',
            ru: '550 монет (+10%)',
        },
        prices: {
            RUB: '500',
            USD: '5',
            EUR: '5',
        },
    },
]

const now = () => new Date().toISOString()

/** As id-api: the token issued just before gets the same new pair for 20 s; any older one fails. */
const GRACE_MS = 20_000

function issue(session) {
    const accessToken = `at.${randomUUID()}`
    session.previous = session.refreshToken
    session.refreshToken = `${session.id}.${randomUUID()}`
    session.lastActiveAt = now()
    tokens.set(accessToken, session.id)
    session.issued = {
        accessToken,
        accessExpiresAt: new Date(Date.now() + ttlOf(users.get(session.userId).email)).toISOString(),
        refreshToken: session.refreshToken,
        sessionId: session.id,
    }
    session.issuedAt = Date.now()
    return session.issued
}

function userFor(email) {
    let id = byEmail.get(email)
    if (!id) {
        id = randomUUID()
        byEmail.set(email, id)
        users.set(id, {
            id,
            email,
            displayName: null,
            locale: 'en',
            roles: [],
            balance: 0,
            tx: [],
            notifications: [
                {
                    id: randomUUID(),
                    kind: 'welcome',
                    params: {},
                    read: false,
                    createdAt: now(),
                },
            ],
        })
    }
    return users.get(id)
}

function openSession(userId, request, authMethod, clientId = null) {
    const session = {
        id: randomUUID(),
        userId,
        userAgent: request.headers['user-agent'] ?? null,
        authMethod,
        clientId,
        createdAt: Date.now(),
        revoked: false,
    }
    sessions.set(session.id, session)
    return issue(session)
}

const challenge = () => {
    const id = randomUUID()
    passkeyChallenges.add(id)
    return {
        challengeId: id,
        challenge: randomBytes(32).toString('base64url'),
    }
}

const passkeyView = key => ({
    id: key.id,
    name: key.name,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    synced: false,
    usable: true,
    credentialId: key.credentialId,
})

function caller(request) {
    const token = request.headers.authorization?.replace(/^Bearer /, '')
    const session = sessions.get(tokens.get(token))
    // As id-api: the access token of an ended session stays valid; only GET /me/session says so.
    if (!session) return undefined
    return {
        session,
        user: users.get(session.userId),
    }
}

function credit(user, amount, source) {
    const before = user.balance
    user.balance += amount
    user.tx.unshift({
        id: randomUUID(),
        kind: 'credit',
        source,
        amount: `+${amount}`,
        balanceBefore: String(before),
        balanceAfter: String(user.balance),
        createdAt: now(),
    })
    user.notifications.unshift({
        id: randomUUID(),
        kind: 'wallet.credited',
        params: {
            amount: String(amount),
            balanceAfter: String(user.balance),
            source,
        },
        read: false,
        createdAt: now(),
    })
}

const paymentView = payment => ({
    ...payment,
    checkoutUrl: payment.status === 'pending' ? payment.checkoutUrl : null,
})

/** As the APIs' lists: `limit` 1-100 (25 by default), or a fixed page, and an opaque cursor after the last item. */
function paged(items, request, extra = {}, fixedPage = undefined) {
    const query = new URL(request.url, 'http://mock').searchParams
    const limit = fixedPage ?? Number(query.get('limit') ?? 25)
    const from = query.has('cursor') ? Number(Buffer.from(query.get('cursor'), 'base64url').toString()) : 0
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(from) || from < 0)
        return [
            400,
            {
                code: 'VALIDATION_FAILED',
            },
        ]
    return [
        200,
        {
            items: items.slice(from, from + limit),
            nextCursor: from + limit < items.length ? Buffer.from(String(from + limit)).toString('base64url') : null,
            ...extra,
        },
    ]
}

const FAULT_CODES = {
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    503: 'UNAVAILABLE',
}

/** [method, pattern, needs a signed-in caller, handler(match, body, request, who)] */
const routes = [
    [
        'GET',
        /^\/health$/,
        false,
        () => [
            200,
            {
                status: 'ok',
            },
        ],
    ],
    [
        'GET',
        /^\/google\/authorize$/,
        false,
        (_, __, request) => {
            const asked = new URL(request.url, 'http://mock').searchParams
            const answer = /(?:^|;\s*)google_answer=([^;]+)/.exec(request.headers.cookie ?? '')?.[1] ?? ''
            const [kind, value] = decodeURIComponent(answer).split(/:(.*)/s)
            const back = new URL(asked.get('redirect_uri') ?? SITE_URL)
            if (kind === 'email') back.searchParams.set('code', `google:${value}`)
            else back.searchParams.set('error', value || 'access_denied')
            back.searchParams.set('state', asked.get('state') ?? '')
            return [
                302,
                undefined,
                {
                    location: back.toString(),
                },
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/session$/,
        true,
        (_, __, ___, { session }) => {
            session.activeChecks = (session.activeChecks ?? 0) + 1
            return [
                200,
                {
                    active: !session.revoked,
                },
            ]
        },
    ],
    [
        'GET',
        /^\/session-checks$/,
        false,
        (_, __, request) => {
            const email = new URL(request.url, 'http://mock').searchParams.get('email')
            const user = userFor(String(email).toLowerCase())
            return [
                200,
                {
                    checks: [
                        ...sessions.values(),
                    ]
                        .filter(session => session.userId === user.id)
                        .reduce((total, session) => total + (session.activeChecks ?? 0), 0),
                },
            ]
        },
    ],
    [
        'GET',
        /^\/calls$/,
        false,
        () => [
            200,
            calls,
        ],
    ],
    [
        'GET',
        /^\/challenges$/,
        false,
        (_, __, request) => [
            200,
            codesSent.get(new URL(request.url, 'http://mock').searchParams.get('email')?.toLowerCase()) ?? {
                issued: [],
                used: [],
            },
        ],
    ],
    [
        'POST',
        /^\/seed$/,
        false,
        (_, body) => {
            // Oldest first, so item 1 ends up last: the one behind "Show more".
            const user = userFor(String(body.email).toLowerCase())
            for (let i = 1; i <= (body.payments ?? 0); i += 1) {
                const id = randomUUID()
                payments.set(id, {
                    id,
                    userId: user.id,
                    key: `seed-${id}`,
                    productKey: 'coins-100',
                    coins: String(i),
                    amount: String(i),
                    currency: 'USD',
                    provider: 'fake',
                    status: 'succeeded',
                    checkoutUrl: null,
                    paidAt: now(),
                    createdAt: now(),
                })
            }
            for (let i = 1; i <= (body.notifications ?? 0); i += 1)
                user.notifications.unshift({
                    id: randomUUID(),
                    kind: 'wallet.credited',
                    params: {
                        amount: String(i),
                        balanceAfter: String(i),
                        source: 'grant',
                    },
                    read: false,
                    createdAt: now(),
                })
            for (let i = 1; i <= (body.tx ?? 0); i += 1) {
                const before = user.balance
                user.balance += i
                user.tx.unshift({
                    id: randomUUID(),
                    kind: 'grant',
                    source: 'grant',
                    amount: `+${i}`,
                    balanceBefore: String(before),
                    balanceAfter: String(user.balance),
                    createdAt: now(),
                })
            }
            for (let i = 1; i <= (body.sessions ?? 0); i += 1) {
                const id = randomUUID()
                sessions.set(id, {
                    id,
                    userId: user.id,
                    userAgent: `seed-device-${i}`,
                    authMethod: 'email',
                    clientId: null,
                    createdAt: Date.now(),
                    lastActiveAt: new Date(Date.now() - (body.sessions - i + 1) * 60_000).toISOString(),
                    revoked: false,
                })
            }
            for (let i = 1; i <= (body.passkeys ?? 0); i += 1) {
                const credentialId = randomBytes(16).toString('base64url')
                passkeys.set(credentialId, {
                    id: randomUUID(),
                    credentialId,
                    userId: user.id,
                    name: `seed-key-${i}`,
                    createdAt: now(),
                    lastUsedAt: null,
                })
            }
            return [
                204,
            ]
        },
    ],
    [
        'POST',
        /^\/payments\/created$/,
        false,
        (_, body) => {
            const user = userFor(String(body.email).toLowerCase())
            for (const payment of payments.values())
                if (payment.userId === user.id && payment.status === 'creating') payment.status = 'pending'
            return [
                204,
            ]
        },
    ],
    [
        'POST',
        /^\/faults$/,
        false,
        (_, body) => {
            faults.push({
                email: String(body.email).toLowerCase(),
                method: body.method,
                path: new RegExp(body.path),
                query: body.query ? new RegExp(body.query) : undefined,
                status: body.status,
            })
            return [
                204,
            ]
        },
    ],
    [
        'DELETE',
        /^\/faults$/,
        false,
        (_, body) => {
            const email = String(body.email).toLowerCase()
            for (let i = faults.length - 1; i >= 0; i -= 1) if (faults[i].email === email) faults.splice(i, 1)
            return [
                204,
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/login\/email$/,
        false,
        (_, body) => {
            const email = String(body.email).toLowerCase()
            if (email.startsWith('limited-')) return rateLimited(LIMITED_WAIT_MS)
            if (email.startsWith('throttled-')) return rateLimited()
            const challengeId = randomUUID()
            challenges.set(challengeId, email)
            const sent = codesSent.get(email) ?? {
                issued: [],
                used: [],
            }
            sent.issued.push(challengeId)
            codesSent.set(email, sent)
            const cooldown = email.startsWith('resend-') ? SHORT_COOLDOWN_MS : RESEND_COOLDOWN_MS
            return [
                202,
                {
                    challengeId,
                    expiresAt: new Date(Date.now() + 600_000).toISOString(),
                    resendAfter: new Date(Date.now() + cooldown).toISOString(),
                    deliveryStatus: email.startsWith('undeliverable-') ? 'failed' : 'accepted',
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/login\/email\/verify$/,
        false,
        (_, body, request) => {
            const email = challenges.get(body.challengeId)
            if (!email) return invalid('expired')
            if (email.startsWith('verify-limited-')) return rateLimited(LIMITED_WAIT_MS)
            if (body.code !== CODE) return invalid('invalid_code')
            challenges.delete(body.challengeId)
            codesSent.get(email)?.used.push(body.challengeId)
            const user = userFor(email)
            return [
                200,
                openSession(user.id, request, 'email'),
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/login\/google\/config$/,
        false,
        () => [
            200,
            {
                enabled: true,
                authorizationEndpoint: `http://127.0.0.1:${PORT}/google/authorize`,
                clientId: 'mock-google-client',
                redirectUri: `${SITE_URL}/login/google/callback`,
            },
        ],
    ],
    [
        'POST',
        /^\/api\/v1\/login\/google$/,
        false,
        (_, body, request) => {
            const email = String(body.code).replace(/^google:/, '')
            if (!body.code?.startsWith('google:') || !body.nonce || !body.codeVerifier)
                return refused(422, 'code', 'invalid_grant')
            let userId = googleLinks.get(email)
            if (!userId) {
                if (byEmail.has(email)) return refused(409, 'email', 'link_required')
                userId = userFor(email).id
                googleLinks.set(email, userId)
            }
            return [
                200,
                openSession(userId, request, 'google'),
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/identities$/,
        true,
        (_, __, ___, { user }) => [
            200,
            {
                items: [
                    ...googleLinks,
                ]
                    .filter(([, userId]) => userId === user.id)
                    .map(([email]) => ({
                        provider: 'google',
                        email,
                        linkedAt: now(),
                    })),
            },
        ],
    ],
    [
        'POST',
        /^\/api\/v1\/me\/identities\/google$/,
        true,
        (_, body, __, { user }) => {
            // As id-api: only a recent sign-in may link Google (`stale-` sessions are old).
            if (user.email.startsWith('stale-')) return refused(403, 'session', 'reauthentication_required')
            const email = String(body.code).replace(/^google:/, '')
            const owner = googleLinks.get(email)
            if (owner && owner !== user.id) return refused(409, 'identity', 'in_use')
            googleLinks.set(email, user.id)
            return [
                200,
                {
                    items: [],
                },
            ]
        },
    ],
    [
        'DELETE',
        /^\/api\/v1\/me\/identities\/google$/,
        true,
        (_, __, ___, { user }) => {
            for (const [email, userId] of googleLinks) if (userId === user.id) googleLinks.delete(email)
            return [
                204,
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/login\/passkey\/options$/,
        false,
        () => {
            const { challengeId, challenge: value } = challenge()
            return [
                200,
                {
                    challengeId,
                    options: {
                        challenge: value,
                        rpId: 'localhost',
                        timeout: 60_000,
                        userVerification: 'required',
                    },
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/login\/passkey\/verify$/,
        false,
        (_, body, request) => {
            if (!passkeyChallenges.delete(body.challengeId)) return refused(422, 'challenge', 'stale')
            const key = passkeys.get(body.response?.id)
            if (!key) return refused(422, 'passkey', 'unknown')
            key.lastUsedAt = now()
            return [
                200,
                openSession(key.userId, request, 'passkey'),
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/passkeys$/,
        true,
        (_, __, ___, { user }) => [
            200,
            {
                items: [
                    ...passkeys.values(),
                ]
                    .filter(key => key.userId === user.id)
                    .map(passkeyView),
            },
        ],
    ],
    [
        'POST',
        /^\/api\/v1\/me\/passkeys\/options$/,
        true,
        (_, __, ___, { user, session }) => {
            // As id-api: only a recent sign-in may add a passkey (`stale-` sessions are old).
            if (user.email.startsWith('stale-')) return refused(403, 'session', 'reauthentication_required')
            void session
            const { challengeId, challenge: value } = challenge()
            return [
                200,
                {
                    challengeId,
                    options: {
                        rp: {
                            id: 'localhost',
                            name: 'nick-lukashik (e2e)',
                        },
                        user: {
                            id: Buffer.from(user.id.replaceAll('-', ''), 'hex').toString('base64url'),
                            name: user.email,
                            displayName: user.email,
                        },
                        challenge: value,
                        pubKeyCredParams: [
                            {
                                type: 'public-key',
                                alg: -7,
                            },
                        ],
                        timeout: 60_000,
                        attestation: 'none',
                        excludeCredentials: [
                            ...passkeys.values(),
                        ]
                            .filter(key => key.userId === user.id)
                            .map(key => ({
                                id: key.credentialId,
                                type: 'public-key',
                            })),
                        authenticatorSelection: {
                            residentKey: 'required',
                            userVerification: 'required',
                        },
                    },
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/me\/passkeys$/,
        true,
        (_, body, __, { user }) => {
            if (!passkeyChallenges.delete(body.challengeId)) return refused(422, 'challenge', 'stale')
            const key = {
                id: randomUUID(),
                credentialId: body.response.id,
                userId: user.id,
                name: body.name,
                createdAt: now(),
                lastUsedAt: null,
            }
            passkeys.set(key.credentialId, key)
            return [
                201,
                passkeyView(key),
            ]
        },
    ],
    [
        'DELETE',
        /^\/api\/v1\/me\/passkeys\/([\w-]+)$/,
        true,
        ([, id], _, __, { user }) => {
            for (const [credentialId, key] of passkeys)
                if (key.id === id && key.userId === user.id) passkeys.delete(credentialId)
            return [
                204,
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/oauth\/clients\/([\w-]+)$/,
        false,
        ([, id], _, request) => {
            const redirectUri = new URL(request.url, 'http://mock').searchParams.get('redirectUri')
            if (id !== 'landing-web' || redirectUri !== APP_CALLBACK) return refused(422, 'redirectUri', 'unregistered')
            return [
                200,
                {
                    id,
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/oauth\/authorize$/,
        true,
        (_, body) => {
            if (body.clientId !== 'landing-web' || body.redirectUri !== APP_CALLBACK)
                return refused(422, 'redirectUri', 'unregistered')
            return [
                200,
                {
                    code: randomBytes(32).toString('base64url'),
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/sessions\/refresh$/,
        false,
        (_, body, request) => {
            calls.refresh += 1
            calls.refreshRequestIds.push(request.headers['x-request-id'] ?? null)
            const session = sessions.get(String(body.refreshToken).split('.')[0])
            if (session && !session.revoked && session.refreshToken === body.refreshToken)
                return [
                    200,
                    issue(session),
                ]
            if (session && session.previous === body.refreshToken && Date.now() - session.issuedAt < GRACE_MS)
                return [
                    200,
                    session.issued,
                ]
            if (session) session.revoked = true
            return [
                401,
                {
                    code: 'UNAUTHENTICATED',
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/sessions\/logout$/,
        false,
        (_, body) => {
            const session = sessions.get(String(body.refreshToken).split('.')[0])
            if (session) session.revoked = true
            return [
                204,
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me$/,
        true,
        (_, __, ___, { user }) => [
            200,
            {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                locale: user.locale,
                roles: user.roles,
            },
        ],
    ],
    [
        'PATCH',
        /^\/api\/v1\/me$/,
        true,
        (_, body, __, { user }) => {
            if (body.displayName !== undefined) user.displayName = body.displayName || null
            if (body.locale) user.locale = body.locale
            return [
                200,
                {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    locale: user.locale,
                    roles: user.roles,
                },
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/sessions$/,
        true,
        (_, __, request, { user, session }) =>
            paged(
                [
                    ...sessions.values(),
                ]
                    .filter(item => item.userId === user.id && !item.revoked)
                    .toSorted((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
                    .map(item => ({
                        id: item.id,
                        lastActiveAt: item.lastActiveAt,
                        userAgent: item.userAgent,
                        authMethod: item.authMethod,
                        clientId: item.clientId,
                        current: item.id === session.id,
                    })),
                request,
                {},
                SESSIONS_PAGE,
            ),
    ],
    [
        'DELETE',
        /^\/api\/v1\/me\/sessions\/([\w-]+)$/,
        true,
        ([, id], _, __, { user }) => {
            const target = sessions.get(id)
            if (target?.userId === user.id) target.revoked = true
            return [
                204,
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/me\/sessions\/revoke-others$/,
        true,
        (_, __, ___, { user, session }) => {
            for (const item of sessions.values())
                if (item.userId === user.id && item.id !== session.id) item.revoked = true
            return [
                200,
                {},
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/wallet$/,
        true,
        (_, __, ___, { user }) => [
            200,
            {
                unit: 'COIN',
                balance: String(user.balance),
                state: 'active',
                exists: user.tx.length > 0,
                updatedAt: user.tx[0]?.createdAt ?? null,
            },
        ],
    ],
    [
        'GET',
        /^\/api\/v1\/me\/wallet\/history$/,
        true,
        (_, __, request, { user }) => paged(user.tx, request),
    ],
    [
        'GET',
        /^\/api\/v1\/catalog$/,
        false,
        () => [
            200,
            {
                items: catalog,
            },
        ],
    ],
    [
        'POST',
        /^\/api\/v1\/me\/checkout$/,
        true,
        (_, body, request, { user }) => {
            const key = request.headers['idempotency-key']
            const existing = [
                ...payments.values(),
            ].find(payment => payment.userId === user.id && payment.key === key)
            if (existing)
                return [
                    200,
                    paymentView(existing),
                ]
            const product = catalog.find(item => item.key === body.productKey)
            if (!product)
                return [
                    400,
                    {
                        code: 'VALIDATION_FAILED',
                    },
                ]
            const id = randomUUID()
            const payment = {
                id,
                userId: user.id,
                key,
                productKey: product.key,
                coins: product.coins,
                amount: product.prices[body.currency],
                currency: body.currency,
                provider: 'fake',
                status: user.email.startsWith('creating-')
                    ? 'creating'
                    : user.email.startsWith('lost-')
                      ? 'failed'
                      : 'pending',
                checkoutUrl: `${SITE_URL}/payments/fake/${id}`,
                paidAt: null,
                createdAt: now(),
            }
            payments.set(id, payment)
            return [
                201,
                paymentView(payment),
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/payments$/,
        true,
        (_, __, request, { user }) =>
            paged(
                [
                    ...payments.values(),
                ]
                    .filter(payment => payment.userId === user.id)
                    .reverse()
                    .map(paymentView),
                request,
            ),
    ],
    [
        'GET',
        /^\/api\/v1\/me\/payments\/([\w-]+)$/,
        true,
        ([, id], _, __, { user }) => {
            const payment = payments.get(id)
            return payment?.userId === user.id
                ? [
                      200,
                      paymentView(payment),
                  ]
                : notFound()
        },
    ],
    [
        'POST',
        /^\/api\/v1\/me\/payments\/([\w-]+)\/fake-complete$/,
        true,
        ([, id], _, __, { user }) => {
            const payment = payments.get(id)
            if (payment?.userId !== user.id) return notFound()
            if (payment.status === 'pending') {
                payment.status = 'succeeded'
                payment.paidAt = now()
                credit(user, Number(payment.coins), 'pack')
            }
            return [
                200,
                paymentView(payment),
            ]
        },
    ],
    [
        'GET',
        /^\/api\/v1\/me\/notifications$/,
        true,
        (_, __, request, { user }) =>
            paged(user.notifications, request, {
                unreadCount: user.notifications.filter(item => !item.read).length,
            }),
    ],
    [
        'POST',
        /^\/api\/v1\/me\/notifications\/read-all$/,
        true,
        (_, __, ___, { user }) => {
            for (const item of user.notifications) item.read = true
            return [
                200,
                {
                    read: user.notifications.length,
                },
            ]
        },
    ],
    [
        'POST',
        /^\/api\/v1\/me\/notifications\/([\w-]+)\/read$/,
        true,
        ([, id], _, __, { user }) => {
            const item = user.notifications.find(entry => entry.id === id)
            if (!item) return notFound()
            item.read = true
            return [
                204,
            ]
        },
    ],
]

function invalid(reason) {
    return [
        422,
        {
            code: 'UNPROCESSABLE',
            details: [
                {
                    path: 'code',
                    message: reason,
                },
            ],
        },
    ]
}

/** As id-api: its limiter names the wait in `details`; a throttler's 429 has none. */
function rateLimited(retryAfterMs) {
    return [
        429,
        {
            code: 'RATE_LIMITED',
            ...(retryAfterMs === undefined
                ? {}
                : {
                      details: [
                          {
                              path: 'retryAfterMs',
                              message: String(retryAfterMs),
                          },
                      ],
                  }),
        },
    ]
}

function refused(status, path, message) {
    return [
        status,
        {
            code: status === 409 ? 'CONFLICT' : status === 403 ? 'FORBIDDEN' : 'UNPROCESSABLE',
            details: [
                {
                    path,
                    message,
                },
            ],
        },
    ]
}

function notFound() {
    return [
        404,
        {
            code: 'NOT_FOUND',
        },
    ]
}

createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const text = Buffer.concat(chunks).toString()
    const body = text ? JSON.parse(text) : {}
    const { pathname: path, search } = new URL(request.url ?? '/', 'http://mock')
    let result = notFound()
    for (const [method, pattern, signedIn, handler] of routes) {
        const match = request.method === method ? pattern.exec(path) : null
        if (!match) continue
        const who = signedIn ? caller(request) : undefined
        // Refresh and sign-out carry no access token: the refresh token says whose they are.
        const of = who?.user ?? users.get(sessions.get(String(body.refreshToken).split('.')[0])?.userId)
        const fault =
            of
            && faults.find(
                item =>
                    item.email === of.email
                    && item.method === method
                    && item.path.test(path)
                    && (!item.query || item.query.test(search)),
            )
        result =
            signedIn && !who
                ? [
                      401,
                      {
                          code: 'UNAUTHENTICATED',
                      },
                  ]
                : fault
                  ? [
                        fault.status,
                        {
                            code: FAULT_CODES[fault.status] ?? 'FAILED',
                        },
                    ]
                  : handler(match, body, request, who)
        break
    }
    const [status, payload, extra = {}] = result
    response.writeHead(status, {
        ...(payload === undefined
            ? {}
            : {
                  'content-type': 'application/json',
              }),
        ...extra,
    })
    response.end(payload === undefined ? undefined : JSON.stringify(payload))
}).listen(PORT, '127.0.0.1')

// The stand-in app: any page is a page, so the browser can land on its callback.
const app = new URL(APP_CALLBACK)
createServer((_, response) => {
    response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
    })
    response.end('<!doctype html><html lang="en"><title>app</title><h1>app</h1></html>')
}).listen(Number(app.port), app.hostname === 'localhost' ? '127.0.0.1' : app.hostname)
