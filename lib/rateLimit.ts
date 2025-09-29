export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
  limit: number
}

const RATE_LIMIT_WINDOW_MS = Number(process.env.GUIDES_RATE_WINDOW_MS ?? 60_000)
const RATE_LIMIT_MAX = Number(process.env.GUIDES_RATE_LIMIT ?? 180)

const buckets = new Map<string, { count: number; expiresAt: number }>()

export const checkRateLimit = (
  identifier: string,
  limit: number = RATE_LIMIT_MAX,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): RateLimitResult => {
  const now = Date.now()
  const bucket = buckets.get(identifier)

  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(identifier, { count: 1, expiresAt: now + windowMs })
    return { allowed: true, remaining: Math.max(0, limit - 1), reset: now + windowMs, limit }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, reset: bucket.expiresAt, limit }
  }

  bucket.count += 1
  buckets.set(identifier, bucket)
  return { allowed: true, remaining: Math.max(0, limit - bucket.count), reset: bucket.expiresAt, limit }
}
