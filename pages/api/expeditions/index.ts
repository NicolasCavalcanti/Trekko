import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma, ExpeditionStatus } from '@prisma/client'

import prisma from '../../../lib/prisma'
import { verifyAuthToken } from '../../../lib/authToken'

const MAX_PAGE_SIZE = 50

type GuideUser = Prisma.UserGetPayload<{ include: { guide: true } }>

function getQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1
  }
  return parsed
}

function parsePageSize(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return 20
  }
  return Math.min(parsed, MAX_PAGE_SIZE)
}

function parseDate(value: string): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

async function findGuideUserByEmail(email: string): Promise<GuideUser | null> {
  if (!email) {
    return null
  }
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { guide: true }
  })
}

async function resolveAuthenticatedGuide(payload: Awaited<ReturnType<typeof verifyAuthToken>>): Promise<GuideUser | null> {
  if (!payload) {
    return null
  }

  const candidates: number[] = []
  if (typeof payload.id === 'number' && Number.isFinite(payload.id)) {
    candidates.push(payload.id)
  } else if (typeof payload.id === 'string') {
    const parsedId = Number.parseInt(payload.id, 10)
    if (Number.isFinite(parsedId)) {
      candidates.push(parsedId)
    }
  }

  for (const candidate of candidates) {
    const user = await prisma.user.findUnique({
      where: { id: candidate },
      include: { guide: true }
    })
    if (user) {
      return user
    }
  }

  if (typeof payload.email === 'string' && payload.email.trim()) {
    const user = await findGuideUserByEmail(payload.email.trim())
    if (user) {
      return user
    }
  }

  return null
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const statusQuery = getQueryValue(req.query.status).toLowerCase() || 'active'
  const searchQuery = getQueryValue(req.query.search)
  const stateQuery = getQueryValue(req.query.state)
  const trailIdQuery = getQueryValue(req.query.trailId || req.query.trail)
  const levelQuery = getQueryValue(req.query.level)
  const startDateQuery = getQueryValue(req.query.startDate)
  const endDateQuery = getQueryValue(req.query.endDate)
  const guideIdQuery = getQueryValue(req.query.guideId || req.query.guideUserId)
  const pageQuery = getQueryValue(req.query.page) || '1'
  const pageSizeQuery = getQueryValue(req.query.pageSize) || '20'

  const page = parsePage(pageQuery)
  const pageSize = parsePageSize(pageSizeQuery)
  const skip = (page - 1) * pageSize

  const filters: Prisma.ExpeditionWhereInput[] = []

  const normalizedStatus = statusQuery.trim() || 'active'
  const today = startOfToday()

  if (normalizedStatus === 'active') {
    filters.push({ status: ExpeditionStatus.ACTIVE })
    filters.push({ startDate: { gte: today } })
  } else if (normalizedStatus === 'historic') {
    filters.push({ status: ExpeditionStatus.ACTIVE })
    filters.push({ endDate: { lt: today } })
  } else if (normalizedStatus === 'inactive') {
    filters.push({ status: ExpeditionStatus.INACTIVE })
  } else if (normalizedStatus === 'cancelled') {
    filters.push({ status: ExpeditionStatus.CANCELLED })
  } else if (normalizedStatus !== 'all') {
    const mapped = normalizedStatus.toUpperCase() as keyof typeof ExpeditionStatus
    if (ExpeditionStatus[mapped]) {
      filters.push({ status: ExpeditionStatus[mapped] })
    }
  }

  if (searchQuery) {
    filters.push({
      OR: [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { trail: { name: { contains: searchQuery, mode: 'insensitive' } } }
      ]
    })
  }

  if (stateQuery) {
    filters.push({ trail: { state: { equals: stateQuery, mode: 'insensitive' } } })
  }

  if (trailIdQuery) {
    filters.push({ trailId: trailIdQuery })
  }

  if (levelQuery) {
    filters.push({ difficultyLevel: { equals: levelQuery, mode: 'insensitive' } })
  }

  if (guideIdQuery) {
    let guideUserIdFilter: number | null = null
    const numericGuideId = Number.parseInt(guideIdQuery, 10)
    if (!Number.isNaN(numericGuideId)) {
      guideUserIdFilter = numericGuideId
    } else if (guideIdQuery.includes('@')) {
      const guideUser = await findGuideUserByEmail(guideIdQuery)
      if (guideUser) {
        guideUserIdFilter = guideUser.id
      }
    }

    if (guideUserIdFilter !== null) {
      filters.push({ guideUserId: guideUserIdFilter })
    }
  }

  const startDateFilter = parseDate(startDateQuery)
  if (startDateFilter) {
    filters.push({ startDate: { gte: startDateFilter } })
  }

  const endDateFilter = parseDate(endDateQuery)
  if (endDateFilter) {
    filters.push({ endDate: { lte: endDateFilter } })
  }

  const where: Prisma.ExpeditionWhereInput = filters.length ? { AND: filters } : {}

  const [total, expeditions] = await prisma.$transaction([
    prisma.expedition.count({ where }),
    prisma.expedition.findMany({
      where,
      orderBy: { startDate: 'asc' },
      include: {
        trail: true,
        guideUser: {
          include: {
            guide: true
          }
        }
      },
      skip,
      take: pageSize
    })
  ])

  const data = expeditions.map(expedition => ({
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
  }))

  return res.status(200).json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0
    }
  })
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const payload = await verifyAuthToken(token)

  if (!payload) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' })
  }

  const user = await resolveAuthenticatedGuide(payload)

  if (!user) {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' })
  }

  if (user.role !== 'guide') {
    return res.status(403).json({ message: 'Apenas guias autenticados podem criar expedições.' })
  }

  if (!user.guide) {
    return res.status(403).json({ message: 'Perfil de guia não encontrado.' })
  }

  if (user.guide.validity && user.guide.validity.getTime() < Date.now()) {
    return res.status(403).json({ message: 'Perfil de guia com CADASTUR expirado.' })
  }

  const {
    trailId,
    trailName,
    trailState,
    trailCity,
    trailPark,
    title,
    description,
    highlights,
    difficultyLevel,
    startDate,
    endDate,
    pricePerPerson,
    maxPeople
  } = req.body as Record<string, unknown>

  const normalizedTrailId = String(trailId ?? '').trim()
  if (!normalizedTrailId) {
    return res.status(400).json({ message: 'Trilha obrigatória.' })
  }

  const normalizedTitle = String(title ?? '').trim()
  if (!normalizedTitle) {
    return res.status(400).json({ message: 'Título é obrigatório.' })
  }

  const normalizedDescription = String(description ?? '').trim()
  if (!normalizedDescription) {
    return res.status(400).json({ message: 'Descrição é obrigatória.' })
  }

  const normalizedDifficulty = String(difficultyLevel ?? '').trim()
  if (!normalizedDifficulty) {
    return res.status(400).json({ message: 'Nível de dificuldade é obrigatório.' })
  }

  const start = parseDate(String(startDate ?? ''))
  const end = parseDate(String(endDate ?? ''))
  if (!start || !end) {
    return res.status(400).json({ message: 'Datas inválidas.' })
  }

  if (end < start) {
    return res.status(400).json({ message: 'Data de término deve ser posterior à data de início.' })
  }

  const price = typeof pricePerPerson === 'string' || typeof pricePerPerson === 'number'
    ? Number(pricePerPerson)
    : Number.NaN
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ message: 'Preço por pessoa inválido.' })
  }

  const maxPeopleValue = typeof maxPeople === 'string' || typeof maxPeople === 'number'
    ? Number.parseInt(String(maxPeople), 10)
    : Number.NaN
  if (!Number.isFinite(maxPeopleValue) || maxPeopleValue <= 0) {
    return res.status(400).json({ message: 'Número máximo de pessoas inválido.' })
  }

  const persistedTrail = await prisma.trail.upsert({
    where: { id: normalizedTrailId },
    create: {
      id: normalizedTrailId,
      name: String(trailName ?? normalizedTitle).trim() || normalizedTitle,
      state: String(trailState ?? '').trim() || null,
      city: String(trailCity ?? '').trim() || null,
      park: String(trailPark ?? '').trim() || null
    },
    update: {
      name: String(trailName ?? normalizedTitle).trim() || normalizedTitle,
      state: String(trailState ?? '').trim() || null,
      city: String(trailCity ?? '').trim() || null,
      park: String(trailPark ?? '').trim() || null
    }
  })

  const expedition = await prisma.expedition.create({
    data: {
      trailId: persistedTrail.id,
      guideUserId: user.id,
      title: normalizedTitle,
      description: normalizedDescription,
      highlights: String(highlights ?? '').trim() || null,
      difficultyLevel: normalizedDifficulty,
      startDate: start,
      endDate: end,
      pricePerPerson: new Prisma.Decimal(price.toFixed(2)),
      maxPeople: maxPeopleValue,
      status: ExpeditionStatus.ACTIVE
    }
  })

  return res.status(201).json({ id: expedition.id })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res)
    }

    if (req.method === 'POST') {
      return await handlePost(req, res)
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ message: 'Método não permitido.' })
  } catch (error) {
    console.error('Failed to handle /api/expeditions request', error)
    return res.status(500).json({ message: 'Erro interno ao processar a requisição.' })
  }
}
