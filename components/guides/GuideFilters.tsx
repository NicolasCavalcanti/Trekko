import React from 'react'

export interface GuideFilterState {
  uf: string
  municipio: string
  nome: string
  cadastur: string
  sort: string
}

interface GuideFiltersProps {
  filters: GuideFilterState
  onChange: (field: keyof GuideFilterState, value: string) => void
  onSubmit: () => void
  onReset: () => void
  ufOptions: string[]
  municipioOptions: string[]
  isLoadingMunicipios?: boolean
}

export const GuideFilters: React.FC<GuideFiltersProps> = ({
  filters,
  onChange,
  onSubmit,
  onReset,
  ufOptions,
  municipioOptions,
  isLoadingMunicipios
}) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 grid gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      aria-label="Filtros para buscar guias"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="filterUf" className="block text-sm font-medium text-gray-700">
            UF
          </label>
          <select
            id="filterUf"
            name="uf"
            value={filters.uf}
            onChange={(event) => onChange('uf', event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
          >
            <option value="">Todas</option>
            {ufOptions.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filterMunicipio" className="block text-sm font-medium text-gray-700">
            Município
          </label>
          <select
            id="filterMunicipio"
            name="municipio"
            value={filters.municipio}
            onChange={(event) => onChange('municipio', event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
            disabled={!filters.uf || isLoadingMunicipios}
          >
            <option value="">Todos</option>
            {municipioOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          {filters.uf && isLoadingMunicipios && <p className="mt-1 text-xs text-gray-500">Carregando municípios…</p>}
        </div>

        <div>
          <label htmlFor="filterNome" className="block text-sm font-medium text-gray-700">
            Nome do guia
          </label>
          <input
            id="filterNome"
            name="nome"
            type="text"
            value={filters.nome}
            onChange={(event) => onChange('nome', event.target.value)}
            placeholder="Ex.: Ana"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
          />
        </div>

        <div>
          <label htmlFor="filterCadastur" className="block text-sm font-medium text-gray-700">
            Nº Cadastur
          </label>
          <input
            id="filterCadastur"
            name="cadastur"
            type="text"
            value={filters.cadastur}
            onChange={(event) => onChange('cadastur', event.target.value)}
            placeholder="Digite o número completo"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
          />
        </div>

        <div>
          <label htmlFor="filterSort" className="block text-sm font-medium text-gray-700">
            Ordenar por
          </label>
          <select
            id="filterSort"
            name="sort"
            value={filters.sort}
            onChange={(event) => onChange('sort', event.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
          >
            <option value="nome_asc">Nome (A-Z)</option>
            <option value="nome_desc">Nome (Z-A)</option>
            <option value="municipio_asc">Município (A-Z)</option>
            <option value="uf_asc">UF (A-Z)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-trekko-blue px-4 py-2 text-sm font-semibold text-white hover:bg-trekko-green focus:bg-trekko-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow"
        >
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-trekko-blue hover:bg-trekko-yellow/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow"
        >
          Limpar
        </button>
      </div>
    </form>
  )
}

export default GuideFilters
