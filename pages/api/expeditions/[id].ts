import type { NextApiRequest, NextApiResponse } from 'next'

import prisma from '../../../lib/prisma'

function toNumber(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) {
    return toNumber(value[0])
  }
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return parsed
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ message: 'Método não permitido.' })
  }

  const expeditionId = toNumber(req.query.id)
  if (!expeditionId) {
    return res.status(400).json({ message: 'Identificador inválido.' })
  }

  try {
    const expedition = await prisma.expedition.findUnique({
      where: { id: expeditionId },
      include: {
        trail: true,
        guideUser: {
          include: {
            guide: true
          }
        }
      }
    })

    if (!expedition) {
      return res.status(404).json({ message: 'Expedição não encontrada.' })
    }

    return res.status(200).json({
      id: expedition.id,
      trailId: expedition.trailId,
      title: expedition.title,
      description: expedition.description,
      highlights: expedition.highlights,
      difficultyLevel: expedition.difficultyLevel,
      startDate: expedition.startDate.toISOString(),
      endDate: expedition.endDate.toISOString(),
      pricePerPerson: Number(expedition.pricePerPerson),
      maxPeople: expedition.maxPeople,
      status: expedition.status,
      createdAt: expedition.createdAt.toISOString(),
      updatedAt: expedition.updatedAt.toISOString(),
      trail: expedition.trail
        ? {
            id: expedition.trail.id,
            name: expedition.trail.name,
            state: expedition.trail.state,
            city: expedition.trail.city,
            park: expedition.trail.park
          }
        : null,
      guide: expedition.guideUser
        ? {
            id: expedition.guideUser.id,
            name: expedition.guideUser.name,
            email: expedition.guideUser.email,
            role: expedition.guideUser.role,
            cadastur: expedition.guideUser.guide?.cadastur
          }
        : null
    })
  } catch (error) {
    console.error('Failed to load expedition', error)
    return res.status(500).json({ message: 'Erro interno ao carregar a expedição.' })
  }
}
