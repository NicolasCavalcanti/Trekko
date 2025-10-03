import crypto from 'crypto'
import { Guide, PrismaClient, Prisma } from '@prisma/client'

import { signJwt } from './jwt'

const ACCESS_TOKEN_TTL_SECONDS = Number.parseInt(process.env.GUIDE_ACCESS_TOKEN_TTL || '86400', 10)
const REFRESH_TOKEN_TTL_SECONDS = Number.parseInt(process.env.GUIDE_REFRESH_TOKEN_TTL || '2592000', 10)
const accessTtl = Number.isFinite(ACCESS_TOKEN_TTL_SECONDS) ? ACCESS_TOKEN_TTL_SECONDS : 86400
const refreshTtl = Number.isFinite(REFRESH_TOKEN_TTL_SECONDS) ? REFRESH_TOKEN_TTL_SECONDS : 2592000

export interface GuideSessionUser {
  id: number
  email: string
  name: string
  type: 'guide'
  role: 'guia'
  cadastur: string
  phone?: string | null
  state?: string | null
  city?: string | null
  contacts?: unknown
  photoUrl?: string | null
}

export interface GuideSessionPayload {
  accessToken: string
  refreshToken: string
  expiresAt: string
  refreshExpiresAt: string
  tokenType: 'Bearer'
  user: GuideSessionUser
}

function normalizeContacts(contacts: Prisma.JsonValue | null): unknown {
  if (!contacts || typeof contacts !== 'object') {
    return null
  }
  return contacts
}

export type PublicGuide = Omit<Guide, 'password'>

export function sanitizeGuideForClient(guide: Guide): PublicGuide {
  const { password, ...rest } = guide
  return rest
}

export function buildGuideSessionUser(guide: Guide): GuideSessionUser {
  return {
    id: guide.id,
    email: guide.email,
    name: guide.name,
    type: 'guide',
    role: 'guia',
    cadastur: guide.cadastur,
    phone: guide.phone ?? null,
    state: guide.uf ?? null,
    city: guide.city ?? null,
    contacts: normalizeContacts(guide.contacts ?? null),
    photoUrl: guide.photoUrl ?? null
  }
}

function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('hex')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

export async function createGuideSession(prisma: PrismaClient, guide: Guide): Promise<GuideSessionPayload> {
  const payload = {
    user_id: guide.id,
    id: guide.id,
    role: 'guia',
    type: 'guide',
    email: guide.email,
    name: guide.name,
    cadastur: guide.cadastur
  }

  const { token: accessToken, expiresAt } = signJwt(payload, { expiresInSeconds: accessTtl })
  const { token: refreshToken, hash } = createRefreshToken()
  const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000)

  await prisma.guideSession.create({
    data: {
      guideId: guide.id,
      refreshTokenHash: hash,
      expiresAt: refreshExpiresAt
    }
  })

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    tokenType: 'Bearer',
    user: buildGuideSessionUser(guide)
  }
}

export async function revokeGuideSessionByToken(prisma: PrismaClient, refreshToken: string): Promise<boolean> {
  if (!refreshToken) {
    return false
  }
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const existing = await prisma.guideSession.findUnique({
    where: { refreshTokenHash: hash }
  })
  if (!existing) {
    return false
  }
  if (existing.revokedAt) {
    return true
  }
  await prisma.guideSession.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() }
  })
  return true
}

export async function rotateGuideSession(
  prisma: PrismaClient,
  refreshToken: string
): Promise<{ guide: Guide; session: GuideSessionPayload } | null> {
  if (!refreshToken) {
    return null
  }
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const existing = await prisma.guideSession.findUnique({
    where: { refreshTokenHash: hash },
    include: { guide: true }
  })
  if (!existing || !existing.guide) {
    return null
  }
  if (existing.revokedAt) {
    return null
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    await prisma.guideSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    })
    return null
  }

  const result = await prisma.$transaction(async tx => {
    await tx.guideSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    })
    const session = await createGuideSession(tx, existing.guide)
    return { guide: existing.guide, session }
  })

  return result
}
