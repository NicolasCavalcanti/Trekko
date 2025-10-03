import type { NextApiRequest, NextApiResponse } from 'next'

import prisma from '../../../../lib/prisma'
import { revokeGuideSessionByToken } from '../../../../lib/guideAuth'

interface LogoutBody {
  refreshToken?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Método não suportado.' })
  }

  const body = req.body as LogoutBody | undefined
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : ''
  if (!refreshToken) {
    return res.status(400).json({ message: 'Token de atualização é obrigatório.' })
  }

  try {
    const revoked = await revokeGuideSessionByToken(prisma, refreshToken)
    return res.status(200).json({ success: revoked })
  } catch (error) {
    console.error('Erro ao encerrar sessão', error)
    return res.status(500).json({ message: 'Não foi possível encerrar a sessão.' })
  }
}
