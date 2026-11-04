import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Authenticated encryption of a small JSON value (AES-256-GCM): the cookie is
 * opaque to the browser and any change to it fails to open. The key is
 * SHA-256 of the secret; the purpose is bound as associated data, so a login
 * cookie cannot be replayed as a session cookie.
 */
const key = (secret: string) => createHash('sha256').update(secret).digest()

export function seal(value: unknown, secret: string, purpose: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
    cipher.setAAD(Buffer.from(purpose))
    const body = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
    ])
    return Buffer.concat([
        iv,
        cipher.getAuthTag(),
        body,
    ]).toString('base64url')
}

export function unseal<T>(sealed: string | undefined, secret: string, purpose: string): T | undefined {
    if (!sealed || sealed.length > 4_096) return undefined
    try {
        const raw = Buffer.from(sealed, 'base64url')
        const decipher = createDecipheriv('aes-256-gcm', key(secret), raw.subarray(0, 12))
        decipher.setAAD(Buffer.from(purpose))
        decipher.setAuthTag(raw.subarray(12, 28))
        const plain = Buffer.concat([
            decipher.update(raw.subarray(28)),
            decipher.final(),
        ])
        return JSON.parse(plain.toString('utf8')) as T
    } catch {
        return undefined
    }
}
