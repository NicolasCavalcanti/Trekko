import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useState } from 'react'
import GuideCard from '../../components/guides/GuideCard'
import GuideFilters, { type GuideFilterState } from '../../components/guides/GuideFilters'
import Pagination from '../../components/guides/Pagination'
import type { GuideListResponse } from '../../types/guide'

const DEFAULT_PAGE_SIZE = Number(process.env.NEXT_PUBLIC_GUIDES_PAGE_SIZE ?? 30) || 30

const GuidesPage: React.FC = () => {
  const router = useRouter()
  const [filters, setFilters] = useState<GuideFilterState>({
    uf: '',
    municipio: '',
    nome: '',
    cadastur: '',
    sort: 'nome_asc'
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [listData, setListData] = useState<GuideListResponse | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [ufOptions, setUfOptions] = useState<string[]>([])
  const [municipioOptions, setMunicipioOptions] = useState<string[]>([])
  const [isLoadingMunicipios, setIsLoadingMunicipios] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!router.isReady) return

    const queryValue = (value: string | string[] | undefined) => {
      if (!value) return ''
      return Array.isArray(value) ? value[0] : value
    }

    const nextFilters: GuideFilterState = {
      uf: queryValue(router.query.uf).toUpperCase(),
      municipio: queryValue(router.query.municipio),
      nome: queryValue(router.query.nome),
      cadastur: queryValue(router.query.cadastur),
      sort: queryValue(router.query.sort) || 'nome_asc'
    }

    setFilters((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(nextFilters)) {
        return prev
      }
      return nextFilters
    })

    const pageNumber = Number(queryValue(router.query.page) || '1')
    setCurrentPage(Number.isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber)
  }, [router.isReady, router.query])

  const apiQuery = useMemo(() => {
    if (!router.isReady) return null
    const params = new URLSearchParams()

    const queryValue = (key: string) => {
      const value = router.query[key]
      if (!value) return ''
      return Array.isArray(value) ? value[0] : value
    }

    const uf = queryValue('uf')
    const municipio = queryValue('municipio')
    const nome = queryValue('nome')
    const cadastur = queryValue('cadastur')
    const sort = queryValue('sort') || 'nome_asc'
    const pageParam = Number(queryValue('page') || '1')
    const pageSizeParam = Number(queryValue('pageSize') || DEFAULT_PAGE_SIZE)

    if (uf) params.set('uf', uf)
    if (municipio) params.set('municipio', municipio)
    if (nome) params.set('nome', nome)
    if (cadastur) params.set('cadastur', cadastur)
    if (sort) params.set('sort', sort)

    params.set('page', (Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam).toString())
    params.set('pageSize', (Number.isNaN(pageSizeParam) || pageSizeParam < 1 ? DEFAULT_PAGE_SIZE : Math.min(pageSizeParam, DEFAULT_PAGE_SIZE)).toString())

    return params.toString()
  }, [router.isReady, router.query])

  useEffect(() => {
    if (!router.isReady) return
    let active = true
    const controller = new AbortController()

    const fetchGuides = async () => {
      if (!apiQuery) return
      setIsLoadingList(true)
      setListError(null)
      try {
        const res = await fetch(`/api/guias?${apiQuery}`, { signal: controller.signal })
        if (!res.ok) {
          throw new Error('Erro ao carregar guias')
        }
        const payload = (await res.json()) as GuideListResponse
        if (active) {
          setListData(payload)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err)
          setListError('Não foi possível carregar os guias.')
        }
      } finally {
        if (active) {
          setIsLoadingList(false)
        }
      }
    }

    fetchGuides()

    return () => {
      active = false
      controller.abort()
    }
  }, [router.isReady, apiQuery, reloadToken])

  useEffect(() => {
    if (!router.isReady) return
    let active = true
    const loadUfs = async () => {
      try {
        const res = await fetch('/api/guias/filters')
        if (!res.ok) throw new Error('Erro ao carregar UFs')
        const payload = (await res.json()) as { ufs: string[] }
        if (active) setUfOptions(payload.ufs)
      } catch (err) {
        console.error(err)
      }
    }
    loadUfs()
    return () => {
      active = false
    }
  }, [router.isReady])

  useEffect(() => {
    if (!filters.uf) {
      setMunicipioOptions([])
      setIsLoadingMunicipios(false)
      return
    }
    let active = true
    const controller = new AbortController()
    const loadMunicipios = async () => {
      setIsLoadingMunicipios(true)
      try {
        const res = await fetch(`/api/guias/filters?uf=${encodeURIComponent(filters.uf)}`, {
          signal: controller.signal
        })
        if (!res.ok) throw new Error('Erro ao carregar municípios')
        const payload = (await res.json()) as { municipios: string[] }
        if (active) setMunicipioOptions(payload.municipios)
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err)
        }
      } finally {
        if (active) setIsLoadingMunicipios(false)
      }
    }
    loadMunicipios()
    return () => {
      active = false
      controller.abort()
    }
  }, [filters.uf])

  const handleFilterChange = (field: keyof GuideFilterState, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'uf') {
        next.municipio = ''
      }
      return next
    })
  }

  const applyFilters = () => {
    const query: Record<string, string> = {}
    if (filters.uf) query.uf = filters.uf
    if (filters.municipio) query.municipio = filters.municipio
    if (filters.nome) query.nome = filters.nome
    if (filters.cadastur) query.cadastur = filters.cadastur
    if (filters.sort && filters.sort !== 'nome_asc') query.sort = filters.sort
    query.page = '1'
    query.pageSize = DEFAULT_PAGE_SIZE.toString()

    router.push({ pathname: '/guias', query }, undefined, { shallow: true })
  }

  const resetFilters = () => {
    setFilters({ uf: '', municipio: '', nome: '', cadastur: '', sort: 'nome_asc' })
    router.push({ pathname: '/guias' }, undefined, { shallow: true })
  }

  const handlePageChange = (page: number) => {
    const query = { ...router.query, page: page.toString() }
    if (!query.pageSize) {
      query.pageSize = DEFAULT_PAGE_SIZE.toString()
    }
    router.push({ pathname: '/guias', query }, undefined, { shallow: true })
  }

  const totalItems = listData?.totalItems ?? 0
  const totalPages = listData?.totalPages ?? 0
  const itemsCount = listData?.items.length ?? 0
  const isLoading = isLoadingList
  const error = listError
  const retry = () => setReloadToken((prev) => prev + 1)

  return (
    <>
      <Head>
        <title>Guias CADASTUR | Trekko</title>
        <meta
          name="description"
          content="Conheça guias credenciados no CADASTUR em todo o Brasil. Filtre por UF, município ou nome e encontre seu guia Trekko."
        />
      </Head>
      <main className="min-h-screen bg-gray-50 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <header className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-trekko-blue">Guias CADASTUR</h1>
            <p className="mt-2 text-gray-600">
              Exibindo {itemsCount} de {totalItems} guias
            </p>
          </header>

          <GuideFilters
            filters={filters}
            onChange={handleFilterChange}
            onSubmit={applyFilters}
            onReset={resetFilters}
            ufOptions={ufOptions}
            municipioOptions={municipioOptions}
            isLoadingMunicipios={isLoadingMunicipios}
          />

          {isLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-xl bg-white shadow-inner">
                  <div className="h-40 rounded-t-xl bg-gray-200" />
                  <div className="space-y-3 p-4">
                    <div className="h-6 rounded bg-gray-200" />
                    <div className="h-4 rounded bg-gray-200" />
                    <div className="h-4 rounded bg-gray-200" />
                    <div className="h-4 rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-red-700" role="alert">
              <p className="font-semibold">Não foi possível carregar os guias.</p>
              <p className="mt-2 text-sm">Tente novamente.</p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 inline-flex items-center rounded-md bg-trekko-blue px-4 py-2 text-sm font-semibold text-white hover:bg-trekko-green focus:bg-trekko-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!isLoading && !error && listData && listData.items.length === 0 && (
            <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-gray-600">
              Nenhum guia encontrado. Ajuste os filtros.
            </div>
          )}

          {!isLoading && !error && listData && listData.items.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listData.items.map((guide) => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            disabled={isLoading}
          />
        </div>
      </main>
    </>
  )
}

export default GuidesPage
