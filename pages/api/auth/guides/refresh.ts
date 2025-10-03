import type { NextApiRequest, NextApiResponse } from 'next'

import prisma from '../../../../lib/prisma'
import { rotateGuideSession, sanitizeGuideForClient, type GuideSessionPayload } from '../../../../lib/guideAuth'

interface RefreshBody {
  refreshToken?: string
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

  const body = req.body as RefreshBody | undefined
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!refreshToken) {
    return res.status(400).json({ message: 'Token de atualização é obrigatório.' })
  }

  try {
    const rotation = await rotateGuideSession(prisma, refreshToken)
    if (!rotation) {
      return res.status(401).json({ message: 'Sessão inválida ou expirada.' })
    }

    return res.status(200).json({
      guide: sanitizeGuideForClient(rotation.guide),
      session: buildGuideResponseSession(rotation.session)
    })
  } catch (error) {
    console.error('Erro ao renovar sessão', error)
    return res.status(500).json({ message: 'Não foi possível renovar a sessão.' })
  }
}
