import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { checkRateLimit } from '../../../lib/rateLimit'
import { createHash } from 'crypto'

const buildEtag = (payload: unknown) =>
  `W/"${createHash('sha256').update(JSON.stringify(payload)).digest('base64')}"`

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

  const cadastur = Array.isArray(req.query.cadastur) ? req.query.cadastur[0] : req.query.cadastur
  if (!cadastur) {
    return res.status(400).json({ error: 'Informe o número do Cadastur' })
  }

  try {
    const start = Date.now()
    const guide = await prisma.cadasturGuide.findUnique({
      where: { cadastur }
    })

    if (!guide) {
      return res.status(404).json({ error: 'Guia não encontrado' })
    }

    const responsePayload = {
      id: guide.id,
      cadastur: guide.cadastur,
      nome_completo: guide.nomeCompleto,
      uf: guide.uf,
      municipio: guide.municipio,
      whatsapp: guide.whatsapp,
      instagram: guide.instagram,
      foto_url: guide.fotoUrl,
      bio: guide.bio,
      expedicoes: []
    }

    const etag = buildEtag(responsePayload)
    if (req.headers['if-none-match'] === etag) {
      res.setHeader('Cache-Control', cacheControl)
      res.setHeader('ETag', etag)
      return res.status(304).end()
    }

    res.setHeader('Cache-Control', cacheControl)
    res.setHeader('ETag', etag)

    const duration = Date.now() - start
    console.info('[api/guias/:cadastur] detail', {
      cadastur,
      durationMs: duration
    })

    return res.status(200).json(responsePayload)
  } catch (error) {
    console.error('[api/guias/:cadastur] error', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default handler
