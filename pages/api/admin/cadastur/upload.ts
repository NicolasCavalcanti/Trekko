import type { NextApiRequest, NextApiResponse } from 'next'
import Papa from 'papaparse'
import prisma from '../../../../lib/prisma'
import {
  normalizeGuideRecord,
  REQUIRED_CSV_COLUMNS,
  type CadasturCsvRecord,
  type NormalizedGuideRecord
} from '../../../../lib/cadastur'

interface ParsedMultipartFile {
  filename: string
  content: string
}

const readMultipartCsv = async (req: NextApiRequest): Promise<ParsedMultipartFile | null> => {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return null
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
  if (!boundaryMatch) {
    return null
  }
  const boundary = boundaryMatch[1]

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const buffer = Buffer.concat(chunks)
  const rawParts = buffer
    .toString('utf8')
    .split(`--${boundary}`)
    .filter((part) => part.trim() && part.trim() !== '--')

  for (const rawPart of rawParts) {
    const part = rawPart.trim()
    const [rawHeaders, ...bodyParts] = part.split('\r\n\r\n')
    if (!rawHeaders || bodyParts.length === 0) continue
    const headers = rawHeaders.split('\r\n').filter(Boolean)
    const disposition = headers.find((header) => header.toLowerCase().startsWith('content-disposition'))
    if (!disposition || !/filename="/i.test(disposition)) continue

    const filenameMatch = disposition.match(/filename="([^"]+)"/i)
    const filename = filenameMatch?.[1] ?? 'upload.csv'
    const body = bodyParts.join('\r\n\r\n')
    const content = body.replace(/\r\n--$/g, '').replace(/\r\n$/g, '')

    return { filename, content }
  }

  return null
}

export const config = {
  api: {
    bodyParser: false
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const parsedFile = await readMultipartCsv(req)
    if (!parsedFile) {
      return res.status(400).json({ error: 'Arquivo CSV não enviado. Use o campo "file".' })
    }

    const content = parsedFile.content
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true
    })

    if (parsed.errors.length > 0) {
      console.error('[admin/cadastur/upload] parse errors', parsed.errors)
      return res.status(400).json({ error: 'Erro ao ler CSV', details: parsed.errors })
    }

    const fields = parsed.meta.fields ?? []
    const missing = REQUIRED_CSV_COLUMNS.filter((col) => !fields.includes(col))
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'CSV inválido',
        details: `Colunas obrigatórias ausentes: ${missing.join(', ')}`
      })
    }

    const normalized: NormalizedGuideRecord[] = []
    const errors: string[] = []
    const seenCadastur = new Set<string>()

    parsed.data.forEach((row, index) => {
      const castRow: CadasturCsvRecord = {
        nome_completo: row['nome_completo'],
        cadastur: row['cadastur'],
        uf: row['uf'],
        municipio: row['municipio'],
        whatsapp: row['whatsapp'],
        instagram: row['instagram'],
        foto_url: row['foto_url'],
        bio: row['bio']
      }

      const normalizedRow = normalizeGuideRecord(castRow)
      if (!normalizedRow) {
        errors.push(`Linha ${index + 2}: dados obrigatórios ausentes ou inválidos.`)
        return
      }

      if (seenCadastur.has(normalizedRow.cadastur)) {
        errors.push(`Linha ${index + 2}: número Cadastur duplicado no arquivo (${normalizedRow.cadastur}).`)
        return
      }
      seenCadastur.add(normalizedRow.cadastur)
      normalized.push(normalizedRow)
    })

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro válido encontrado.', details: errors })
    }

    let inserted = 0
    let updated = 0

    await prisma.$transaction(async (tx) => {
      for (const guide of normalized) {
        const existing = await tx.cadasturGuide.findUnique({ where: { cadastur: guide.cadastur } })

        await tx.cadasturGuide.upsert({
          where: { cadastur: guide.cadastur },
          create: {
            cadastur: guide.cadastur,
            nomeCompleto: guide.nome_completo,
            uf: guide.uf,
            municipio: guide.municipio,
            whatsapp: guide.whatsapp,
            instagram: guide.instagram,
            fotoUrl: guide.foto_url,
            bio: guide.bio
          },
          update: {
            nomeCompleto: guide.nome_completo,
            uf: guide.uf,
            municipio: guide.municipio,
            whatsapp: guide.whatsapp,
            instagram: guide.instagram,
            fotoUrl: guide.foto_url,
            bio: guide.bio
          }
        })

        if (existing) {
          updated += 1
        } else {
          inserted += 1
        }
      }
    })

    console.info('[admin/cadastur/upload] import summary', {
      inserted,
      updated,
      discarded: errors.length
    })

    return res.status(200).json({
      inserted,
      updated,
      discarded: errors.length,
      totalValid: normalized.length,
      errors
    })
  } catch (error) {
    console.error('[admin/cadastur/upload] error', error)
    return res.status(500).json({ error: 'Erro interno ao importar CSV' })
  }
}

export default handler
