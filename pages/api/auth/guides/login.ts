import type { NextApiRequest, NextApiResponse } from 'next'
import { UserRole } from '@prisma/client'

import prisma from '../../../../lib/prisma'
import { verifyPassword } from '../../../../lib/password'
import { createGuideSession, sanitizeGuideForClient, type GuideSessionPayload } from '../../../../lib/guideAuth'

interface LoginBody {
  email?: string
  password?: string
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildGuideResponseSession(session: GuideSessionPayload) {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    tokenType: session.tokenType,
    user: session.user
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Método não suportado.' })
  }

  const body = req.body as LoginBody | undefined
  if (!body) {
    return res.status(400).json({ message: 'Corpo da requisição inválido.' })
  }

  const emailRaw = normalizeString(body.email)
  const passwordRaw = body.password || ''
  if (!emailRaw || !passwordRaw) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' })
  }

  try {
    const email = emailRaw.toLowerCase()
    const guide = await prisma.guide.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })

    if (!guide) {
      return res.status(401).json({ message: 'Credenciais inválidas.' })
    }

    const isValid = await verifyPassword(passwordRaw, guide.password)
    if (!isValid) {
      return res.status(401).json({ message: 'Credenciais inválidas.' })
    }

    const result = await prisma.$transaction(async tx => {
      await tx.user.upsert({
        where: { email },
        create: {
          email,
          name: guide.name,
          password: guide.password,
          role: UserRole.guide,
          guideId: guide.id
        },
        update: {
          name: guide.name,
          password: guide.password,
          role: UserRole.guide,
          guideId: guide.id
        }
      })

      const session = await createGuideSession(tx, guide)
      return { guide, session }
    })

    return res.status(200).json({
      guide: sanitizeGuideForClient(result.guide),
      session: buildGuideResponseSession(result.session)
    })
  } catch (error) {
    console.error('Erro ao autenticar guia', error)
    return res.status(500).json({ message: 'Não foi possível autenticar.' })
  }
}
