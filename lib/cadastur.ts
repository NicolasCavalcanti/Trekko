import type { Prisma } from '@prisma/client'

export const REQUIRED_CSV_COLUMNS = [
  'nome_completo',
  'cadastur',
  'uf',
  'municipio',
  'whatsapp',
  'instagram',
  'foto_url',
  'bio'
] as const

export type CadasturCsvRecord = Record<(typeof REQUIRED_CSV_COLUMNS)[number], string | undefined>

export interface NormalizedGuideRecord {
  cadastur: string
  nome_completo: string
  uf: string
  municipio: string
  whatsapp: string | null
  instagram: string | null
  foto_url: string | null
  bio: string | null
}

export const DEFAULT_PAGE_SIZE = Number(process.env.GUIDES_PAGE_SIZE ?? 30)
export const MAX_PAGE_SIZE = 50

export type GuideSortKey = 'nome_asc' | 'nome_desc' | 'municipio_asc' | 'uf_asc'

const TITLE_EXCEPTIONS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export const toTitleCase = (value: string | undefined | null) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((segment, index) =>
      segment
        .split('-')
        .map((piece, pieceIndex) => {
          const lower = piece.trim()
          if (!lower) return ''
          const shouldCapitalize = index === 0 && pieceIndex === 0 ? true : !TITLE_EXCEPTIONS.has(lower)
          if (!shouldCapitalize) {
            return lower
          }
          return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
        })
        .join('-')
    )
    .join(' ')
}

export const sanitizeInstagramHandle = (value: string | undefined | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const handle = trimmed
    .replace(/^https?:\/\/www\.instagram\.com\//i, '')
    .replace(/^https?:\/\/instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
  return handle ? handle : null
}

export const sanitizeWhatsapp = (value: string | undefined | null) => {
  if (!value) return null
  const digits = value.replace(/\D+/g, '')
  if (!digits) return null

  let normalized = digits
  if (normalized.startsWith('00')) {
    normalized = normalized.slice(2)
  }
  if (normalized.startsWith('0')) {
    normalized = normalized.replace(/^0+/, '')
  }

  if (normalized.length === 11) {
    // Assume Brazilian national number missing country code
    normalized = `55${normalized}`
  }

  if (!normalized.startsWith('55') && normalized.length === 10) {
    // US-like without country code
    normalized = `1${normalized}`
  }

  if (normalized.length < 10 || normalized.length > 15) {
    return null
  }

  return `+${normalized}`
}

export const normalizeGuideRecord = (record: CadasturCsvRecord): NormalizedGuideRecord | null => {
  const cadastur = (record.cadastur ?? '').trim()
  const nome = toTitleCase(record.nome_completo)
  const uf = (record.uf ?? '').trim().toUpperCase()
  const municipio = toTitleCase(record.municipio)

  if (!cadastur || !nome || uf.length !== 2 || !municipio) {
    return null
  }

  return {
    cadastur,
    nome_completo: nome,
    uf,
    municipio,
    whatsapp: sanitizeWhatsapp(record.whatsapp),
    instagram: sanitizeInstagramHandle(record.instagram),
    foto_url: record.foto_url?.trim() || null,
    bio: record.bio?.trim() || null
  }
}

export interface GuideQueryParams {
  uf?: string
  municipio?: string
  nome?: string
  cadastur?: string
  page?: string | number
  pageSize?: string | number
  sort?: string
}

export interface GuideQueryOptions {
  where: Prisma.CadasturGuideWhereInput
  orderBy: Prisma.CadasturGuideOrderByWithRelationInput
  skip: number
  take: number
  page: number
  pageSize: number
  sort: GuideSortKey
}

const SORT_MAP: Record<GuideSortKey, Prisma.CadasturGuideOrderByWithRelationInput> = {
  nome_asc: { nomeCompleto: 'asc' },
  nome_desc: { nomeCompleto: 'desc' },
  municipio_asc: { municipio: 'asc' },
  uf_asc: { uf: 'asc' }
}

export const buildGuideQueryOptions = (params: GuideQueryParams): GuideQueryOptions => {
  const sortKey = (params.sort as GuideSortKey) ?? 'nome_asc'
  const sort = SORT_MAP[sortKey] ? (params.sort as GuideSortKey) : 'nome_asc'

  let page = Number(params.page ?? 1)
  if (Number.isNaN(page) || page < 1) page = 1

  let pageSize = Number(params.pageSize ?? DEFAULT_PAGE_SIZE)
  if (Number.isNaN(pageSize) || pageSize < 1) pageSize = DEFAULT_PAGE_SIZE
  pageSize = Math.min(pageSize, MAX_PAGE_SIZE)

  const where: Prisma.CadasturGuideWhereInput = {}

  if (params.uf) {
    where.uf = params.uf.toString().trim().toUpperCase()
  }

  if (params.municipio) {
    where.municipio = {
      contains: params.municipio.toString().trim(),
      mode: 'insensitive'
    }
  }

  if (params.nome) {
    where.nomeCompleto = {
      contains: params.nome.toString().trim(),
      mode: 'insensitive'
    }
  }

  if (params.cadastur) {
    where.cadastur = params.cadastur.toString().trim()
  }

  const skip = (page - 1) * pageSize
  const take = pageSize

  return {
    where,
    orderBy: SORT_MAP[sort],
    skip,
    take,
    page,
    pageSize,
    sort
  }
}
