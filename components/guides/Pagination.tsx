import React from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

const getPages = (current: number, total: number) => {
  const pages: number[] = []
  const delta = 2
  let start = Math.max(1, current - delta)
  let end = Math.min(total, current + delta)

  if (current <= delta) {
    end = Math.min(total, 1 + delta * 2)
  }
  if (current + delta >= total) {
    start = Math.max(1, total - delta * 2)
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  return pages
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, disabled }) => {
  if (totalPages <= 1) return null

  const pages = getPages(currentPage, totalPages)
  const isFirst = currentPage === 1
  const isLast = currentPage === totalPages

  const handleChange = (page: number) => () => {
    if (!disabled && page !== currentPage) {
      onPageChange(page)
    }
  }

  const buttonClasses = (active: boolean) =>
    `min-w-[40px] rounded-full border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow ${
      active
        ? 'bg-trekko-blue text-white border-trekko-blue'
        : 'bg-white text-trekko-blue border-gray-300 hover:bg-trekko-yellow/10'
    }`

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação de guias">
      <button
        type="button"
        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-trekko-blue hover:bg-trekko-yellow/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleChange(1)}
        disabled={isFirst || disabled}
      >
        « Primeira
      </button>
      <button
        type="button"
        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-trekko-blue hover:bg-trekko-yellow/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleChange(currentPage - 1)}
        disabled={isFirst || disabled}
      >
        ‹ Anterior
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={handleChange(page)}
          className={buttonClasses(page === currentPage)}
          aria-current={page === currentPage ? 'page' : undefined}
          disabled={disabled}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-trekko-blue hover:bg-trekko-yellow/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleChange(currentPage + 1)}
        disabled={isLast || disabled}
      >
        Próxima ›
      </button>
      <button
        type="button"
        className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-trekko-blue hover:bg-trekko-yellow/10 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleChange(totalPages)}
        disabled={isLast || disabled}
      >
        Última »
      </button>
    </nav>
  )
}

export default Pagination
