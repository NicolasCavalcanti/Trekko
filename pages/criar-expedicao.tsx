import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'

import styles from '../styles/CreateExpedition.module.css'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

interface Trail {
  id: string
  name: string
  state: string | null
  city: string | null
  park: string | null
}

interface SessionUser {
  type?: string
  cadastur?: string
  name?: string
  [key: string]: unknown
}

interface SessionData {
  token: string
  user: SessionUser
}

interface UploadedImage {
  name: string
  size: number
  dataUrl: string
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (!digits) {
    return ''
  }
  if (digits.length <= 2) {
    return digits
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseBrazilianDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (!match) {
    return null
  }
  const [, dayStr, monthStr, yearStr] = match
  const day = Number.parseInt(dayStr, 10)
  const monthIndex = Number.parseInt(monthStr, 10) - 1
  const year = Number.parseInt(yearStr, 10)

  if (
    Number.isNaN(day)
    || Number.isNaN(monthIndex)
    || Number.isNaN(year)
    || day < 1
    || monthIndex < 0
    || monthIndex > 11
    || year < 1900
  ) {
    return null
  }

  const date = new Date(Date.UTC(year, monthIndex, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function toISODateString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeToStartOfDay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function parseCurrency(value: string): number {
  if (!value) {
    return Number.NaN
  }
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) {
    return ''
  }
  const number = Number(digits) / 100
  return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildTrailLocation(trail: Trail): string {
  const parts = [trail.city, trail.state].filter(Boolean)
  const location = parts.join(' • ')
  if (trail.park) {
    return location ? `${location} • ${trail.park}` : trail.park
  }
  return location
}

type FormErrors = {
  trail: string
  startDate: string
  endDate: string
  price: string
  maxPeople: string
  description: string
  images: string
}

const INITIAL_TOUCHED: Record<keyof FormErrors, boolean> = {
  trail: false,
  startDate: false,
  endDate: false,
  price: false,
  maxPeople: false,
  description: false,
  images: false
}

const ALL_TOUCHED: Record<keyof FormErrors, boolean> = {
  trail: true,
  startDate: true,
  endDate: true,
  price: true,
  maxPeople: true,
  description: true,
  images: true
}

const INITIAL_ERRORS: FormErrors = {
  trail: '',
  startDate: '',
  endDate: '',
  price: '',
  maxPeople: '',
  description: '',
  images: ''
}

export default function CreateExpeditionPage() {
  const [sessionState, setSessionState] = useState<'loading' | 'unauthenticated' | 'forbidden' | 'ready'>('loading')
  const [session, setSession] = useState<SessionData | null>(null)

  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null)
  const [trailSearch, setTrailSearch] = useState('')
  const [trailStateFilter, setTrailStateFilter] = useState('')
  const [trailCityFilter, setTrailCityFilter] = useState('')
  const [trailPage, setTrailPage] = useState(1)
  const [trailTotalPages, setTrailTotalPages] = useState(1)
  const [trailResults, setTrailResults] = useState<Trail[]>([])
  const [isLoadingTrails, setIsLoadingTrails] = useState(false)
  const [trailError, setTrailError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [price, setPrice] = useState('')
  const [maxPeople, setMaxPeople] = useState('')
  const [description, setDescription] = useState('')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)

  const [touched, setTouched] = useState<Record<keyof FormErrors, boolean>>(INITIAL_TOUCHED)
  const [formErrors, setFormErrors] = useState<FormErrors>(INITIAL_ERRORS)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<'success' | 'error' | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const raw = window.localStorage.getItem('trekkoSession')
      if (!raw) {
        setSessionState('unauthenticated')
        return
      }
      const parsed = JSON.parse(raw) as SessionData
      if (!parsed || typeof parsed.token !== 'string' || !parsed.token || !parsed.user) {
        setSessionState('unauthenticated')
        return
      }
      if (parsed.user.type !== 'guide') {
        setSessionState('forbidden')
        return
      }
      if (!parsed.user.cadastur || String(parsed.user.cadastur).trim().length < 3) {
        setSessionState('forbidden')
        return
      }
      setSession(parsed)
      setSessionState('ready')
    } catch (error) {
      console.error('Falha ao ler sessão local', error)
      setSessionState('unauthenticated')
    }
  }, [])

  useEffect(() => {
    setTrailPage(1)
  }, [trailSearch, trailStateFilter, trailCityFilter])

  useEffect(() => {
    if (sessionState !== 'ready') {
      return
    }
    let isCurrent = true
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setIsLoadingTrails(true)
      setTrailError(null)
      try {
        const params = new URLSearchParams()
        if (trailSearch.trim()) {
          params.append('search', trailSearch.trim())
        }
        if (trailStateFilter) {
          params.append('state', trailStateFilter)
        }
        if (trailCityFilter.trim()) {
          params.append('city', trailCityFilter.trim())
        }
        params.append('page', trailPage.toString())
        params.append('pageSize', '8')
        const response = await fetch(`/api/trails?${params.toString()}`, {
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error('Falha ao carregar trilhas')
        }
        const payload = await response.json() as {
          data: Trail[]
          pagination?: { totalPages?: number }
        }
        if (!isCurrent) {
          return
        }
        setTrailResults(Array.isArray(payload.data) ? payload.data : [])
        const total = payload.pagination?.totalPages ?? 1
        setTrailTotalPages(total || 1)
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return
        }
        console.error('Erro ao buscar trilhas', error)
        if (isCurrent) {
          setTrailError('Não foi possível carregar as trilhas no momento.')
          setTrailResults([])
          setTrailTotalPages(1)
        }
      } finally {
        if (isCurrent) {
          setIsLoadingTrails(false)
        }
      }
    }, 280)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [sessionState, trailSearch, trailStateFilter, trailCityFilter, trailPage])

  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  useEffect(() => {
    const errors: FormErrors = { ...INITIAL_ERRORS }

    if (!selectedTrail) {
      errors.trail = 'Selecione uma trilha cadastrada.'
    }

    const parsedStart = startDate ? parseBrazilianDate(startDate) : null
    const parsedEnd = endDate ? parseBrazilianDate(endDate) : null

    if (!startDate) {
      errors.startDate = 'Informe a data inicial.'
    } else if (!parsedStart) {
      errors.startDate = 'Data inválida. Use o formato dd/mm/aaaa.'
    } else if (normalizeToStartOfDay(parsedStart) < today) {
      errors.startDate = 'A data inicial deve ser igual ou posterior a hoje.'
    }

    if (!endDate) {
      errors.endDate = 'Informe a data final.'
    } else if (!parsedEnd) {
      errors.endDate = 'Data inválida. Use o formato dd/mm/aaaa.'
    } else if (parsedStart && normalizeToStartOfDay(parsedEnd) < normalizeToStartOfDay(parsedStart)) {
      errors.endDate = 'A data final deve ser igual ou posterior à data inicial.'
    }

    const priceValue = parseCurrency(price)
    if (!price) {
      errors.price = 'Informe o preço por pessoa.'
    } else if (!Number.isFinite(priceValue) || priceValue <= 0) {
      errors.price = 'Valor inválido. Utilize apenas números.'
    }

    const maxValue = maxPeople ? Number.parseInt(maxPeople, 10) : Number.NaN
    if (!maxPeople) {
      errors.maxPeople = 'Informe o número máximo de pessoas.'
    } else if (!Number.isFinite(maxValue) || maxValue <= 0) {
      errors.maxPeople = 'Informe um número inteiro maior que zero.'
    }

    if (!description.trim()) {
      errors.description = 'Descreva sua expedição.'
    } else if (description.trim().length < 50) {
      errors.description = 'A descrição deve ter pelo menos 50 caracteres.'
    }

    if (imageUploadError) {
      errors.images = imageUploadError
    }

    setFormErrors(errors)
  }, [selectedTrail, startDate, endDate, price, maxPeople, description, imageUploadError, today])

  const isFormValid = useMemo(() => Object.values(formErrors).every(error => !error), [formErrors])

  const handleTrailSelection = useCallback((trail: Trail) => {
    setSelectedTrail(trail)
    setTouched(prev => ({ ...prev, trail: true }))
  }, [])

  const handleImageChange = useCallback((event: FormEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const files = input.files
    setTouched(prev => ({ ...prev, images: true }))
    setImageUploadError(null)
    if (!files || files.length === 0) {
      return
    }

    const newFiles = Array.from(files)
    if (uploadedImages.length + newFiles.length > MAX_IMAGES) {
      setImageUploadError('Você pode enviar até 5 imagens.')
      input.value = ''
      return
    }

    const invalidType = newFiles.find(file => !ACCEPTED_IMAGE_TYPES.includes(file.type))
    if (invalidType) {
      setImageUploadError('Somente imagens JPG, PNG ou WEBP são permitidas.')
      input.value = ''
      return
    }

    const tooLarge = newFiles.find(file => file.size > MAX_IMAGE_SIZE_BYTES)
    if (tooLarge) {
      setImageUploadError('Cada imagem deve ter no máximo 5MB.')
      input.value = ''
      return
    }

    Promise.all(newFiles.map(file => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
      reader.readAsDataURL(file)
    }))).then(results => {
      const imagesToAdd = newFiles.map((file, index) => ({
        name: file.name,
        size: file.size,
        dataUrl: results[index]
      }))
      setUploadedImages(prev => [...prev, ...imagesToAdd])
      setImageUploadError(null)
    }).catch(error => {
      console.error('Erro ao processar imagens', error)
      setImageUploadError('Não foi possível processar as imagens selecionadas.')
    }).finally(() => {
      input.value = ''
    })
  }, [uploadedImages.length])

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, idx) => idx !== index))
    setTouched(prev => ({ ...prev, images: true }))
    setImageUploadError(null)
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ ...ALL_TOUCHED })
    setFeedbackStatus(null)
    setFeedbackMessage('')

    if (!isFormValid || !session || sessionState !== 'ready' || !selectedTrail) {
      return
    }

    const parsedStart = parseBrazilianDate(startDate)
    const parsedEnd = parseBrazilianDate(endDate)
    if (!parsedStart || !parsedEnd) {
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        trailId: selectedTrail.id,
        trailName: selectedTrail.name,
        trailState: selectedTrail.state,
        trailCity: selectedTrail.city,
        trailPark: selectedTrail.park,
        startDate: toISODateString(parsedStart),
        endDate: toISODateString(parsedEnd),
        pricePerPerson: parseCurrency(price),
        maxPeople,
        description: description.trim(),
        images: uploadedImages.map(image => image.dataUrl)
      }

      const response = await fetch('/api/expeditions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string }
        const message = data?.message || 'Erro ao salvar expedição. Tente novamente mais tarde.'
        setFeedbackStatus('error')
        setFeedbackMessage(message)
        return
      }

      setFeedbackStatus('success')
      setFeedbackMessage('Expedição criada com sucesso!')
      setTimeout(() => {
        window.location.href = '/guia_painel.html#expedicoes'
      }, 1600)
    } catch (error) {
      console.error('Falha ao criar expedição', error)
      setFeedbackStatus('error')
      setFeedbackMessage('Erro ao salvar expedição. Tente novamente mais tarde.')
    } finally {
      setIsSubmitting(false)
    }
  }, [description, endDate, isFormValid, maxPeople, price, session, sessionState, selectedTrail, startDate, uploadedImages])

  const renderStatusCard = () => {
    if (sessionState === 'loading') {
      return (
        <div className={styles.statusCard}>
          <p className={styles.loadingMessage}>Carregando informações da sua conta...</p>
        </div>
      )
    }

    if (sessionState === 'unauthenticated') {
      return (
        <div className={styles.statusCard}>
          <h1 className={styles.statusTitle}>Entre como guia para criar expedições</h1>
          <p className={styles.statusDescription}>
            Você precisa estar autenticado com um perfil de guia para acessar esta página. Faça login ou cadastre-se como guia para começar a publicar expedições.
          </p>
          <div className={styles.statusActions}>
            <a className={`${styles.secondaryButton}`} href="/entrar.html">Entrar</a>
            <a className={styles.submitButton} href="/cadastrar_guia.html">Quero ser guia</a>
          </div>
        </div>
      )
    }

    if (sessionState === 'forbidden') {
      return (
        <div className={styles.statusCard}>
          <h1 className={styles.statusTitle}>Verifique seu cadastro de guia</h1>
          <p className={styles.statusDescription}>
            Apenas guias com cadastro CADASTUR válido podem criar expedições. Atualize seus dados ou envie sua documentação para liberar este recurso.
          </p>
          <div className={styles.statusActions}>
            <a className={styles.secondaryButton} href="/guia_painel.html">Ir para o painel do guia</a>
            <a className={styles.submitButton} href="/ajuda.html">Preciso de ajuda</a>
          </div>
        </div>
      )
    }

    return null
  }

  if (sessionState !== 'ready' || !session) {
    return (
      <div className={styles.page}>
        <Head>
          <title>Criar Expedição • Trekko Brasil</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </Head>
        <div className={styles.wrapper}>{renderStatusCard()}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Head>
        <title>Criar Expedição • Trekko Brasil</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <header className={styles.header}>
            <span className={styles.badge}>Guia autenticado</span>
            <h1 className={styles.title}>Criar Expedição</h1>
            <p className={styles.subtitle}>
              Publique uma nova expedição selecionando a trilha, definindo datas, preço e a capacidade máxima. Todos os campos são obrigatórios para garantir que os trekkers recebam informações completas.
            </p>
          </header>
          <form className={styles.form} onSubmit={handleSubmit}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Trilha</h2>
              <div className={styles.trailPicker}>
                <div className={styles.trailControls}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="trailSearch">
                      Buscar por nome, estado ou parque
                    </label>
                    <input
                      id="trailSearch"
                      className={styles.input}
                      type="text"
                      placeholder="Digite parte do nome da trilha"
                      value={trailSearch}
                      onChange={event => setTrailSearch(event.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="trailState">
                      Estado
                    </label>
                    <select
                      id="trailState"
                      className={styles.select}
                      value={trailStateFilter}
                      onChange={event => setTrailStateFilter(event.target.value)}
                    >
                      <option value="">Todos os estados</option>
                      {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="trailCity">
                      Cidade
                    </label>
                    <input
                      id="trailCity"
                      className={styles.input}
                      type="text"
                      placeholder="Cidade ou região"
                      value={trailCityFilter}
                      onChange={event => setTrailCityFilter(event.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.trailResults}>
                  {isLoadingTrails ? (
                    <div className={styles.loadingMessage} style={{ padding: '1rem' }}>
                      Carregando trilhas...
                    </div>
                  ) : trailError ? (
                    <div className={styles.error} style={{ padding: '1rem' }}>{trailError}</div>
                  ) : trailResults.length === 0 ? (
                    <div className={styles.helper} style={{ padding: '1rem' }}>
                      Nenhuma trilha encontrada com os filtros atuais.
                    </div>
                  ) : (
                    <ul className={styles.trailList}>
                      {trailResults.map(trail => {
                        const isSelected = selectedTrail?.id === trail.id
                        return (
                          <li key={trail.id} className={styles.trailItem}>
                            <button
                              type="button"
                              className={`${styles.trailButton} ${isSelected ? styles.trailButtonSelected : ''}`}
                              onClick={() => handleTrailSelection(trail)}
                            >
                              <span className={styles.trailName}>{trail.name}</span>
                              {buildTrailLocation(trail) && (
                                <span className={styles.trailMeta}>{buildTrailLocation(trail)}</span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <div className={styles.pagination}>
                    <button
                      type="button"
                      onClick={() => setTrailPage(page => Math.max(1, page - 1))}
                      disabled={trailPage <= 1}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrailPage(page => (page < trailTotalPages ? page + 1 : page))}
                      disabled={trailPage >= trailTotalPages}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
                {selectedTrail && (
                  <div className={styles.selectedTrail}>
                    <strong>{selectedTrail.name}</strong>
                    <span>{buildTrailLocation(selectedTrail) || 'Localização não informada'}</span>
                  </div>
                )}
                {touched.trail && formErrors.trail && (
                  <span className={styles.error}>{formErrors.trail}</span>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Datas da expedição</h2>
              <div className={styles.trailControls}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="startDate">
                      Data inicial <span className={styles.required}>*</span>
                    </label>
                  </div>
                  <input
                    id="startDate"
                    className={styles.input}
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={startDate}
                    onChange={event => setStartDate(formatDateInput(event.target.value))}
                    onBlur={() => setTouched(prev => ({ ...prev, startDate: true }))}
                  />
                  {touched.startDate && formErrors.startDate && (
                    <span className={styles.error}>{formErrors.startDate}</span>
                  )}
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="endDate">
                      Data final <span className={styles.required}>*</span>
                    </label>
                  </div>
                  <input
                    id="endDate"
                    className={styles.input}
                    type="text"
                    placeholder="dd/mm/aaaa"
                    value={endDate}
                    onChange={event => setEndDate(formatDateInput(event.target.value))}
                    onBlur={() => setTouched(prev => ({ ...prev, endDate: true }))}
                  />
                  {touched.endDate && formErrors.endDate && (
                    <span className={styles.error}>{formErrors.endDate}</span>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Detalhes da expedição</h2>
              <div className={styles.trailControls}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="price">
                      Preço por pessoa (R$) <span className={styles.required}>*</span>
                    </label>
                  </div>
                  <input
                    id="price"
                    className={styles.input}
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={price}
                    onChange={event => setPrice(formatCurrencyInput(event.target.value))}
                    onBlur={() => setTouched(prev => ({ ...prev, price: true }))}
                  />
                  {touched.price && formErrors.price && (
                    <span className={styles.error}>{formErrors.price}</span>
                  )}
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="maxPeople">
                      Quantidade máxima de pessoas <span className={styles.required}>*</span>
                    </label>
                  </div>
                  <input
                    id="maxPeople"
                    className={styles.input}
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ex: 12"
                    value={maxPeople}
                    onChange={event => setMaxPeople(event.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => setTouched(prev => ({ ...prev, maxPeople: true }))}
                  />
                  {touched.maxPeople && formErrors.maxPeople && (
                    <span className={styles.error}>{formErrors.maxPeople}</span>
                  )}
                </div>
              </div>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="description">
                    Descrição da expedição <span className={styles.required}>*</span>
                  </label>
                </div>
                <textarea
                  id="description"
                  className={styles.textarea}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  onBlur={() => setTouched(prev => ({ ...prev, description: true }))}
                  placeholder="Compartilhe os detalhes da expedição: roteiro, tempo estimado, diferenciais, equipamentos, etc."
                />
                <span className={styles.charCount}>{description.trim().length} / mínimo 50 caracteres</span>
                {touched.description && formErrors.description && (
                  <span className={styles.error}>{formErrors.description}</span>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Fotos da expedição</h2>
              <div className={styles.imagesInput}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="images">
                    Adicione até 5 fotos (JPG, PNG ou WEBP)
                  </label>
                  <input
                    id="images"
                    className={styles.input}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                    multiple
                    onChange={handleImageChange}
                    onBlur={() => setTouched(prev => ({ ...prev, images: true }))}
                  />
                  {touched.images && formErrors.images && (
                    <span className={styles.error}>{formErrors.images}</span>
                  )}
                  <span className={styles.helper}>As imagens ajudam trekkers a visualizarem a experiência. Tamanho máximo por arquivo: 5MB.</span>
                </div>
                {uploadedImages.length > 0 && (
                  <div className={styles.imagesPreview}>
                    {uploadedImages.map((image, index) => (
                      <div key={`${image.name}-${index}`} className={styles.imageThumb}>
                        <img src={image.dataUrl} alt={`Pré-visualização ${index + 1}`} />
                        <button
                          type="button"
                          className={styles.removeImageButton}
                          onClick={() => removeImage(index)}
                          aria-label="Remover imagem"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className={styles.submitBar}>
              {feedbackStatus && (
                <span
                  className={`${styles.feedbackMessage} ${feedbackStatus === 'success' ? styles.success : styles.errorMessage}`}
                >
                  {feedbackMessage}
                </span>
              )}
              <div className={styles.submitActions}>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? 'Salvando...' : 'Criar Expedição'}
                </button>
                <a className={styles.secondaryButton} href="/guia_painel.html#expedicoes">
                  Cancelar
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
