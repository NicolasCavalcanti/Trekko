import assert from 'node:assert/strict'
import {
  buildGuideQueryOptions,
  normalizeGuideRecord,
  sanitizeInstagramHandle,
  sanitizeWhatsapp,
  toTitleCase
} from '../lib/cadastur'

const runCadasturTests = () => {
  assert.equal(toTitleCase('ana maria da silva'), 'Ana Maria da Silva')
  assert.equal(toTitleCase('  JOÃO  DOS SANTOS '), 'João dos Santos')
  assert.equal(toTitleCase('maria-aparecida de souza'), 'Maria-Aparecida de Souza')

  assert.equal(sanitizeWhatsapp('(11) 99999-8888'), '+5511999998888')
  assert.equal(sanitizeWhatsapp('5511987654321'), '+5511987654321')
  assert.equal(sanitizeWhatsapp('123'), null)

  assert.equal(sanitizeInstagramHandle('https://instagram.com/trekko.br/'), 'trekko.br')
  assert.equal(sanitizeInstagramHandle('@trekko'), 'trekko')

  const normalized = normalizeGuideRecord({
    nome_completo: 'ana maria',
    cadastur: '123',
    uf: 'sp',
    municipio: 'sao paulo',
    whatsapp: '(11) 99999-9999',
    instagram: 'https://instagram.com/ana',
    foto_url: 'https://example.com/foto.jpg',
    bio: 'bio'
  })

  assert.deepEqual(normalized, {
    nome_completo: 'Ana Maria',
    cadastur: '123',
    uf: 'SP',
    municipio: 'Sao Paulo',
    whatsapp: '+5511999999999',
    instagram: 'ana',
    foto_url: 'https://example.com/foto.jpg',
    bio: 'bio'
  })

  const invalid = normalizeGuideRecord({
    nome_completo: '',
    cadastur: '',
    uf: 'sp',
    municipio: 'sao paulo',
    whatsapp: undefined,
    instagram: undefined,
    foto_url: undefined,
    bio: undefined
  })
  assert.equal(invalid, null)

  const options = buildGuideQueryOptions({ nome: 'ana', page: '2' })
  assert.deepEqual(options.where, {
    nomeCompleto: { contains: 'ana', mode: 'insensitive' }
  })
  assert.equal(options.page, 2)
  assert.ok(options.pageSize > 0)
  assert.equal(options.skip, options.pageSize)

  const clamped = buildGuideQueryOptions({ page: '-5', pageSize: '999', uf: 'sp' })
  assert.equal(clamped.page, 1)
  assert.ok(clamped.pageSize <= 50)
  assert.deepEqual(clamped.where, { uf: 'SP' })
}

runCadasturTests()

console.log('cadastur tests passed')
