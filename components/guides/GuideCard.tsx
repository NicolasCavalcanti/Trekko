import Link from 'next/link'
import React, { useMemo, useState } from 'react'
import type { Guide } from '../../types/guide'

interface GuideCardProps {
  guide: Guide
}

const contactIconClasses =
  'h-10 w-10 flex items-center justify-center rounded-full bg-white text-trekko-blue border border-trekko-blue hover:bg-trekko-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow transition'

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

export const GuideCard: React.FC<GuideCardProps> = ({ guide }) => {
  const [imageError, setImageError] = useState(false)

  const whatsappUrl = useMemo(() => {
    if (!guide.whatsapp) return null
    const digits = guide.whatsapp.replace(/\D+/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }, [guide.whatsapp])

  const instagramUrl = useMemo(() => {
    if (!guide.instagram) return null
    return `https://instagram.com/${guide.instagram}`
  }, [guide.instagram])

  const initials = useMemo(() => initialsFromName(guide.nome_completo), [guide.nome_completo])
  const hasPhoto = Boolean(guide.foto_url && !imageError)

  return (
    <article className="group flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1 focus-within:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-trekko-sand">
        {hasPhoto ? (
          <img
            src={guide.foto_url ?? ''}
            alt={`Foto de ${guide.nome_completo}`}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-trekko-sand to-trekko-yellow text-3xl font-semibold text-trekko-blue" aria-hidden="true">
            {initials}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <Link href={`/guias/${encodeURIComponent(guide.cadastur)}`} className="text-xl font-semibold text-trekko-blue hover:text-trekko-green focus:text-trekko-green focus:outline-none" data-cadastur={guide.cadastur}>
            {guide.nome_completo}
          </Link>
          <p className="mt-1 text-sm text-gray-600">
            {guide.municipio} / {guide.uf}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Cadastur: {guide.cadastur}</p>
        </div>

        <p className="text-sm text-gray-700">
          {guide.bio ?? 'Guia CADASTUR credenciado disponível no Trekko.'}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={contactIconClasses}
                title="Conversar no WhatsApp"
                aria-label="Conversar no WhatsApp"
              >
                <WhatsappIcon />
              </a>
            )}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={contactIconClasses}
                title="Ver Instagram"
                aria-label="Ver Instagram"
              >
                <InstagramIcon />
              </a>
            )}
          </div>
          <Link
            href={`/guias/${encodeURIComponent(guide.cadastur)}`}
            className="inline-flex items-center gap-2 rounded-full bg-trekko-blue px-4 py-2 text-sm font-semibold text-white hover:bg-trekko-green focus:bg-trekko-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </article>
  )
}

export default GuideCard
