import crypto from 'crypto'

type JwtPayload = Record<string, unknown>

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export interface SignJwtOptions {
  expiresInSeconds?: number
  secret?: string
}

export function signJwt(payload: JwtPayload, options: SignJwtOptions = {}): { token: string; expiresAt: Date } {
  const header = { alg: 'HS256', typ: 'JWT' }
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresIn = options.expiresInSeconds ?? 60 * 60 * 24
  const exp = nowSeconds + expiresIn
  const jwtPayload = { ...payload, exp }

  const secret = options.secret || process.env.AUTH_JWT_SECRET || 'trekko_client_secret'
  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(jwtPayload))
  const toSign = `${headerEncoded}.${payloadEncoded}`
  const signature = crypto.createHmac('sha256', secret).update(toSign).digest('hex')
  const token = `${toSign}.${signature}`
  return {
    token,
    expiresAt: new Date(exp * 1000)
  }
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  if (!token) {
    return null
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(payload) as Record<string, unknown>
  } catch (error) {
    return null
  }
}
