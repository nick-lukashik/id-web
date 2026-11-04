// The four APIs id-web calls, in memory, for the e2e suite only: the routes
// and response shapes of id-api, wallet-api, pay-api and notifications-api,
// none of their rules beyond what the pages need. Every sign-in code is
// SIGN_IN_CODE (e2e/servers.ts); each test signs in with its own email.
// GET /calls counts the refreshes (e2e of the proxy's refresh).
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
const SHORT_TTL_MS = 30_000

const users = new Map() // id -> { id, email, displayName, locale, roles, balance, tx[], notifications[] }
const byEmail = new Map() // email -> id
const challenges = new Map() // challengeId -> email
const sessions = new Map() // sessionId -> { id, userId, refreshToken, userAgent, lastActiveAt, revoked }
const tokens = new Map() // accessToken -> sessionId
const googleLinks = new Map() // google email -> userId
const passkeys = new Map() // credentialId -> { id, userId, name, createdAt, lastUsedAt }
const passkeyChallenges = new Set()
const payments = new Map() // id -> payment
const calls = {
    refresh: 0,
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
        accessExpiresAt: new Date(
            Date.now() + (users.get(session.userId).email.startsWith('short-') ? SHORT_TTL_MS : ACCESS_TTL_MS),
        ).toISOString(),
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
    if (!session || session.revoked) return undefined
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
        /^\/calls$/,
        false,
        () => [
            200,
            calls,
        ],
    ],
    [
        'POST',
        /^\/api\/v1\/login\/email$/,
        false,
        (_, body) => {
            const challengeId = randomUUID()
            challenges.set(challengeId, String(body.email).toLowerCase())
            return [
                202,
                {
                    challengeId,
                    expiresAt: new Date(Date.now() + 600_000).toISOString(),
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
            if (body.code !== CODE) return invalid('invalid_code')
            challenges.delete(body.challengeId)
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
        (_, body) => {
            calls.refresh += 1
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
        (_, __, ___, { user, session }) => [
            200,
            {
                items: [
                    ...sessions.values(),
                ]
                    .filter(item => item.userId === user.id && !item.revoked)
                    .map(item => ({
                        id: item.id,
                        lastActiveAt: item.lastActiveAt,
                        userAgent: item.userAgent,
                        authMethod: item.authMethod,
                        clientId: item.clientId,
                        current: item.id === session.id,
                    })),
            },
        ],
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
        (_, __, ___, { user }) => [
            200,
            {
                items: user.tx,
                nextCursor: null,
            },
        ],
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
                status: 'pending',
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
        (_, __, ___, { user }) => [
            200,
            {
                items: [
                    ...payments.values(),
                ]
                    .filter(payment => payment.userId === user.id)
                    .reverse()
                    .map(paymentView),
                nextCursor: null,
            },
        ],
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
        (_, __, ___, { user }) => [
            200,
            {
                items: user.notifications,
                nextCursor: null,
                unreadCount: user.notifications.filter(item => !item.read).length,
            },
        ],
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
    const path = new URL(request.url ?? '/', 'http://mock').pathname
    let result = notFound()
    for (const [method, pattern, signedIn, handler] of routes) {
        const match = request.method === method ? pattern.exec(path) : null
        if (!match) continue
        const who = signedIn ? caller(request) : undefined
        result =
            signedIn && !who
                ? [
                      401,
                      {
                          code: 'UNAUTHENTICATED',
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
