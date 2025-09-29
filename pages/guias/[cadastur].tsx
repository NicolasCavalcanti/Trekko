import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useEffect, useMemo, useState } from 'react'
import type { GuideDetailResponse } from '../../types/guide'

const WhatsappIcon = () => (
  <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className="h-5 w-5">
    <path d="M16 3C9.4 3 4 8.3 4 15c0 2.7.9 5.1 2.5 7.1L5 29l7.1-1.5C13.9 28.4 15 28.6 16 28.6c6.6 0 12-5.3 12-11.9C28 8.3 22.6 3 16 3zm-.1 22.1c-.9 0-1.8-.2-2.7-.5l-.3-.1-4.2.9.9-4.1-.2-.3c-1.4-1.8-2.1-3.9-2.1-6.1 0-5.4 4.4-9.7 9.7-9.7s9.7 4.4 9.7 9.7c.1 5.4-4.3 9.7-9.8 9.7zm5.3-7.1c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.8-.7-1.3-1.6-1.5-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2.1-.3 0-.5-.1-.2-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.3-.3.2-1.1 1-1.1 2.4s1.1 2.8 1.2 3c.2.3 2.2 3.4 5.3 4.7.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.2.2-1.4-.1-.2-.3-.3-.6-.5z" />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
    <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm11 1a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" />
  </svg>
)

const initialsFromName = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const GuideProfilePage: React.FC = () => {
  const router = useRouter()
  const cadastur = typeof router.query.cadastur === 'string' ? router.query.cadastur : undefined
  const [guide, setGuide] = useState<GuideDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [guide?.foto_url])

  useEffect(() => {
    if (!cadastur) return
    let active = true
    const controller = new AbortController()

    const fetchGuide = async () => {
      setIsLoading(true)
      setError(null)
      setNotFound(false)
      try {
        const res = await fetch(`/api/guias/${encodeURIComponent(cadastur)}`, {
          signal: controller.signal
        })
        if (res.status === 404) {
          if (active) {
            setGuide(null)
            setNotFound(true)
          }
          return
        }
        if (!res.ok) {
          throw new Error('Erro ao carregar guia')
        }
        const payload = (await res.json()) as GuideDetailResponse
        if (active) {
          setGuide(payload)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error(err)
          setError('Ocorreu um erro ao carregar o guia. Tente novamente.')
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchGuide()

    return () => {
      active = false
      controller.abort()
    }
  }, [cadastur])

  const whatsappUrl = useMemo(() => {
    if (!guide?.whatsapp) return null
    const digits = guide.whatsapp.replace(/\D+/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }, [guide?.whatsapp])

  const instagramUrl = useMemo(() => {
    if (!guide?.instagram) return null
    return `https://instagram.com/${guide.instagram}`
  }, [guide?.instagram])

  const title = guide ? `${guide.nome_completo} | Guias CADASTUR | Trekko` : 'Guia CADASTUR | Trekko'
  const description = guide
    ? `Guia ${guide.nome_completo} credenciado CADASTUR em ${guide.municipio}/${guide.uf}. Contato, bio e expedições no Trekko.`
    : 'Conheça guias CADASTUR no Trekko.'

  const jsonLd = guide
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: guide.nome_completo,
        identifier: guide.cadastur,
        address: {
          '@type': 'PostalAddress',
          addressLocality: guide.municipio,
          addressRegion: guide.uf,
          addressCountry: 'BR'
        },
        image: guide.foto_url ?? undefined,
        url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/guias/${encodeURIComponent(guide.cadastur)}`
      }
    : null

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      </Head>
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-5xl px-4">
          <Link href="/guias" className="text-sm font-semibold text-trekko-blue hover:text-trekko-green">
            ← Voltar para lista de guias
          </Link>

          {isLoading && (
            <section className="mt-8 animate-pulse rounded-xl bg-white p-6 shadow">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="h-60 w-full rounded-xl bg-gray-200 md:w-60" />
                <div className="flex-1 space-y-4">
                  <div className="h-8 w-1/2 rounded bg-gray-200" />
                  <div className="h-4 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                </div>
              </div>
            </section>
          )}

          {error && !isLoading && (
            <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-6 text-red-700" role="alert">
              {error}
            </div>
          )}

          {!isLoading && !error && notFound && (
            <div className="mt-8 rounded-md border border-gray-200 bg-white p-8 text-center text-gray-600">
              Guia não encontrado.
            </div>
          )}

          {!isLoading && !error && guide && (
            <>
              <section className="mt-8 grid gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow md:grid-cols-[240px,1fr]">
                <div className="overflow-hidden rounded-xl bg-trekko-sand">
                  {guide.foto_url && !imageError ? (
                    <img
                      src={guide.foto_url}
                      alt={`Foto de ${guide.nome_completo}`}
                      className="h-full w-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-60 items-center justify-center bg-gradient-to-br from-trekko-sand to-trekko-yellow text-4xl font-semibold text-trekko-blue">
                      {initialsFromName(guide.nome_completo)}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-trekko-blue">{guide.nome_completo}</h1>
                    <p className="mt-1 text-gray-600">
                      Cadastur {guide.cadastur} · {guide.municipio}/{guide.uf}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        aria-label="Conversar no WhatsApp"
                      >
                        <WhatsappIcon /> WhatsApp
                      </a>
                    )}
                    {instagramUrl && (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-400"
                        aria-label="Ver Instagram"
                      >
                        <InstagramIcon /> Instagram
                      </a>
                    )}
                  </div>

                  {guide.bio && (
                    <div>
                      <h2 className="text-xl font-semibold text-trekko-blue">Sobre</h2>
                      <p className="mt-2 whitespace-pre-line text-gray-700">{guide.bio}</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold text-trekko-blue">Expedições</h2>
                  <Link
                    href={`/expedicoes?guia=${encodeURIComponent(guide.cadastur)}`}
                    className="text-sm font-semibold text-trekko-blue hover:text-trekko-green"
                  >
                    Ver expedições do Trekko
                  </Link>
                </div>

                {guide.expedicoes.length === 0 && (
                  <p className="mt-4 text-gray-600">Nenhuma expedição disponível no momento.</p>
                )}

                {guide.expedicoes.length > 0 && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {guide.expedicoes.map((expedicao) => (
                      <article key={expedicao.id} className="rounded-lg border border-gray-200 p-4 shadow-sm">
                        <h3 className="text-lg font-semibold text-trekko-blue">{expedicao.trilha_nome}</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          {expedicao.cidade}/{expedicao.uf} ·{' '}
                          {new Date(expedicao.data_inicio).toLocaleDateString('pt-BR')} -{' '}
                          {new Date(expedicao.data_fim).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                          {expedicao.preco_por_pessoa.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}{' '}
                          por pessoa
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {expedicao.vagas_disponiveis} vagas disponíveis de {expedicao.vagas_max}
                        </p>
                        <Link
                          href={`/expedicoes?guia=${encodeURIComponent(guide.cadastur)}&expedicao=${expedicao.id}`}
                          className="mt-3 inline-flex items-center rounded-full bg-trekko-yellow px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
                        >
                          Reservar
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

export default GuideProfilePage
