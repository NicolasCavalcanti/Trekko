import crypto from 'crypto'

const DEFAULT_SECRET = 'trekko_client_secret'

function normalizeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  if (base64.length % 4 === 0) {
    return base64
  }
  return base64.padEnd(base64.length + (4 - (base64.length % 4)), '=')
}

function fallbackHashHex(input: string): string {
  const bytes: number[] = []
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3f))
      bytes.push(0x80 | (code & 0x3f))
    }
  }
  let h1 = 0x811c9dc5
  let h2 = 0xc9dc5111
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i]
    h1 = Math.imul(h1 ^ byte, 0x01000193) >>> 0
    h2 = Math.imul(h2 + byte, 0x01000193) >>> 0
  }
  const parts = [
    h1,
    h2,
    h1 ^ h2,
    Math.imul(h1 + 0x9e3779b9, h2 ^ 0x85ebca6b) >>> 0
  ]
  return parts.map(n => n.toString(16).padStart(8, '0')).join('')
}

export type AuthTokenPayload = {
  id: number | string
  email?: string
  type?: string
  name?: string
  exp?: number
  [key: string]: unknown
}

export async function verifyAuthToken(token: string | undefined | null): Promise<AuthTokenPayload | null> {
  if (!token) {
    return null
  }
  const trimmed = token.trim()
  if (!trimmed) {
    return null
  }
  const parts = trimmed.split('.')
  if (parts.length !== 3) {
    return null
  }
  const [headerEncoded, payloadEncoded, signature] = parts
  const toSign = `${headerEncoded}.${payloadEncoded}`
  const secret = process.env.AUTH_JWT_SECRET || DEFAULT_SECRET

  let expectedSignature: string | null = null
  try {
    expectedSignature = crypto.createHmac('sha256', secret).update(toSign).digest('hex')
  } catch (error) {
    expectedSignature = null
  }

  if (expectedSignature !== signature) {
    const fallbackSignature = fallbackHashHex(`${toSign}.${secret}`)
    if (fallbackSignature !== signature) {
      return null
    }
  }

  try {
    const payloadBuffer = Buffer.from(normalizeBase64Url(payloadEncoded), 'base64')
    const payloadJson = payloadBuffer.toString('utf8')
    const payload = JSON.parse(payloadJson) as AuthTokenPayload
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null
    }
    return payload
  } catch (error) {
    return null
  }
}
