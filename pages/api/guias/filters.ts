import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { checkRateLimit } from '../../../lib/rateLimit'

const cacheControl = 'public, max-age=60, s-maxage=60, stale-while-revalidate=30'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const identifier =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  const rate = checkRateLimit(identifier)
  res.setHeader('RateLimit-Limit', rate.limit.toString())
  res.setHeader('RateLimit-Remaining', rate.remaining.toString())
  res.setHeader('RateLimit-Reset', rate.reset.toString())
  if (!rate.allowed) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  try {
    const ufParam = Array.isArray(req.query.uf) ? req.query.uf[0] : req.query.uf

    if (ufParam) {
      const uf = ufParam.trim().toUpperCase()
      if (!uf) {
        return res.status(400).json({ error: 'UF inválida' })
      }

      const municipios = await prisma.cadasturGuide.findMany({
        where: { uf },
        select: { municipio: true },
        distinct: ['municipio'],
        orderBy: { municipio: 'asc' }
      })

      res.setHeader('Cache-Control', cacheControl)
      return res.status(200).json({ municipios: municipios.map((m) => m.municipio) })
    }

    const ufs = await prisma.cadasturGuide.findMany({
      select: { uf: true },
      distinct: ['uf'],
      orderBy: { uf: 'asc' }
    })

    res.setHeader('Cache-Control', cacheControl)
    return res.status(200).json({ ufs: ufs.map((u) => u.uf) })
  } catch (error) {
    console.error('[api/guias/filters] error', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default handler
