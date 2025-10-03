import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma, UserRole } from '@prisma/client'

import prisma from '../../../../lib/prisma'
import { hashPassword } from '../../../../lib/password'
import {
  createGuideSession,
  sanitizeGuideForClient,
  type GuideSessionPayload
} from '../../../../lib/guideAuth'

interface RegisterGuideBody {
  name?: string
  email?: string
  password?: string
  cadastur?: string
  estado?: string
  uf?: string
  municipio?: string
  city?: string
  contatos?: unknown
  contacts?: unknown
  foto_url?: string
  photoUrl?: string
  phone?: string
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeContacts(input: unknown): Prisma.JsonValue | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  try {
    return JSON.parse(JSON.stringify(input)) as Prisma.JsonValue
  } catch (error) {
    return null
  }
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

  const body = req.body as RegisterGuideBody | undefined
  if (!body) {
    return res.status(400).json({ message: 'Corpo da requisição inválido.' })
  }

  const name = normalizeString(body.name) || normalizeString((body as { nome?: string }).nome)
  const emailRaw = normalizeString(body.email)
  const passwordRaw = body.password ?? (body as { senha?: string }).senha
  const cadastur = normalizeString(body.cadastur)
  const estado = normalizeString(body.estado || body.uf).toUpperCase() || null
  const municipio = normalizeString(body.municipio || body.city) || null
  const photoUrl = normalizeString(body.foto_url || body.photoUrl) || null
  const phone = normalizeString(body.phone)
  const contacts = normalizeContacts(body.contatos ?? body.contacts)

  if (!name || !emailRaw || !passwordRaw || !cadastur) {
    return res.status(400).json({ message: 'Nome, e-mail, senha e Cadastur são obrigatórios.' })
  }

  try {
    const email = emailRaw.toLowerCase()
    const passwordHash = await hashPassword(passwordRaw)

    const existingGuide = await prisma.guide.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { cadastur: cadastur }
        ]
      }
    })

    if (existingGuide) {
      return res.status(409).json({ message: 'Já existe um guia cadastrado com estes dados.' })
    }

    const result = await prisma.$transaction(async tx => {
      const guide = await tx.guide.create({
        data: {
          name,
          email,
          password: passwordHash,
          cadastur,
          uf: estado,
          city: municipio,
          phone: phone || null,
          contacts,
          photoUrl
        }
      })

      await tx.user.upsert({
        where: { email },
        create: {
          email,
          name,
          password: passwordHash,
          role: UserRole.guide,
          guideId: guide.id
        },
        update: {
          name,
          password: passwordHash,
          role: UserRole.guide,
          guideId: guide.id
        }
      })

      const session = await createGuideSession(tx, guide)
      return { guide, session }
    })

    return res.status(201).json({
      guide: sanitizeGuideForClient(result.guide),
      session: buildGuideResponseSession(result.session)
    })
  } catch (error) {
    console.error('Erro ao cadastrar guia', error)
    return res.status(500).json({ message: 'Não foi possível cadastrar o guia.' })
  }
}
