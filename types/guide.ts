export interface Guide {
  id: number
  cadastur: string
  nome_completo: string
  uf: string
  municipio: string
  whatsapp: string | null
  instagram: string | null
  foto_url: string | null
  bio: string | null
}

export interface GuideListResponse {
  items: Guide[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ExpeditionSummary {
  id: number
  trilha_nome: string
  cidade: string
  uf: string
  data_inicio: string
  data_fim: string
  preco_por_pessoa: number
  vagas_max: number
  vagas_disponiveis: number
}

export interface GuideDetailResponse extends Guide {
  expedicoes: ExpeditionSummary[]
}
