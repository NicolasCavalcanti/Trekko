import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'

import prisma from '../../../lib/prisma'

const MAX_PAGE_SIZE = 50

function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '*'
  res.setHeader('Access-Control-Allow-Origin', requestOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  const requestedHeaders =
    typeof req.headers['access-control-request-headers'] === 'string'
      ? req.headers['access-control-request-headers']
      : 'Content-Type, Authorization, Accept'
  res.setHeader('Access-Control-Allow-Headers', requestedHeaders)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }

  return false
}

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

function buildSearchFilter(search: string): Prisma.TrailWhereInput | null {
  if (!search) {
    return null
  }
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { state: { contains: search, mode: 'insensitive' } },
      { park: { contains: search, mode: 'insensitive' } }
    ]
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const searchQuery = getQueryValue(req.query.search)
  const stateQuery = getQueryValue(req.query.state)
  const cityQuery = getQueryValue(req.query.city)
  const nameQuery = getQueryValue(req.query.name || req.query.trail)
  const parkQuery = getQueryValue(req.query.park)
  const pageQuery = getQueryValue(req.query.page) || '1'
  const pageSizeQuery = getQueryValue(req.query.pageSize) || '20'

  const page = parsePage(pageQuery)
  const pageSize = parsePageSize(pageSizeQuery)
  const skip = (page - 1) * pageSize

  const filters: Prisma.TrailWhereInput[] = []
  const searchFilter = buildSearchFilter(searchQuery)
  if (searchFilter) {
    filters.push(searchFilter)
  }

  if (stateQuery) {
    filters.push({ state: { equals: stateQuery, mode: 'insensitive' } })
  }

  if (cityQuery) {
    filters.push({ city: { contains: cityQuery, mode: 'insensitive' } })
  }

  if (nameQuery) {
    filters.push({ name: { contains: nameQuery, mode: 'insensitive' } })
  }

  if (parkQuery) {
    filters.push({ park: { contains: parkQuery, mode: 'insensitive' } })
  }

  const where: Prisma.TrailWhereInput = filters.length ? { AND: filters } : {}

  const [total, trails] = await prisma.$transaction([
    prisma.trail.count({ where }),
    prisma.trail.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: pageSize
    })
  ])

  const data = trails.map(trail => ({
    id: trail.id,
    name: trail.name,
    state: trail.state,
    city: trail.city,
    park: trail.park
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (applyCors(req, res)) {
      return
    }

    if (req.method === 'GET') {
      return await handleGet(req, res)
    }

    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ message: 'Método não permitido.' })
  } catch (error) {
    console.error('Failed to handle /api/trails request', error)
    return res.status(500).json({ message: 'Erro interno ao processar a requisição.' })
  }
}
