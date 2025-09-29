import React, { useState } from 'react'

interface ImportSummary {
  inserted: number
  updated: number
  discarded: number
  totalValid: number
  errors?: string[]
}

export default function GuideImport() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      setErrorMessage('Selecione um arquivo CSV do Cadastur antes de enviar.')
      return
    }

    setStatus('uploading')
    setErrorMessage(null)
    setSummary(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/admin/cadastur/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Erro desconhecido' })) as {
          error?: string
          details?: unknown
        }
        setErrorMessage(payload.error || 'Não foi possível importar o arquivo.')
        if (Array.isArray(payload.details)) {
          setSummary({ inserted: 0, updated: 0, discarded: payload.details.length, totalValid: 0, errors: payload.details })
        }
        setStatus('error')
        return
      }

      const payload = (await response.json()) as ImportSummary
      setSummary(payload)
      setStatus('success')
    } catch (error) {
      console.error('Erro ao enviar CSV', error)
      setErrorMessage('Erro inesperado ao enviar o arquivo. Tente novamente.')
      setStatus('error')
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setSummary(null)
    setErrorMessage(null)
    setStatus('idle')
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-trekko-blue mb-2">Importar Guias CADASTUR</h1>
      <p className="text-gray-700 mb-6">
        Faça upload do CSV oficial do CADASTUR para atualizar a base de guias. As colunas obrigatórias são{' '}
        <strong>nome_completo</strong>, <strong>cadastur</strong>, <strong>uf</strong>, <strong>municipio</strong>,{' '}
        <strong>whatsapp</strong>, <strong>instagram</strong>, <strong>foto_url</strong> e <strong>bio</strong>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white shadow rounded-lg p-6">
        <div>
          <label htmlFor="cadasturCsv" className="block text-sm font-medium text-gray-700">
            Arquivo CSV
          </label>
          <input
            id="cadasturCsv"
            name="cadasturCsv"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-trekko-yellow"
            aria-describedby="cadasturCsvHelp"
          />
          <p id="cadasturCsvHelp" className="mt-2 text-sm text-gray-500">
            O arquivo deve conter cabeçalho e estar separado por vírgulas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-trekko-yellow px-4 py-2 font-semibold text-black hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-trekko-yellow disabled:opacity-60"
            disabled={status === 'uploading'}
          >
            {status === 'uploading' ? 'Importando...' : 'Enviar arquivo'}
          </button>
          {file && status === 'idle' && <span className="text-sm text-gray-600">Arquivo selecionado: {file.name}</span>}
        </div>
      </form>

      {errorMessage && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          <p className="font-semibold">Erro</p>
          <p>{errorMessage}</p>
        </div>
      )}

      {summary && (
        <div
          className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-green-900"
          role={status === 'success' ? 'status' : 'alert'}
        >
          <p className="font-semibold mb-2">Resumo da importação</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>{summary.totalValid}</strong> registros válidos processados
            </li>
            <li>
              <strong>{summary.inserted}</strong> novos guias inseridos
            </li>
            <li>
              <strong>{summary.updated}</strong> guias atualizados
            </li>
            <li>
              <strong>{summary.discarded}</strong> linhas descartadas
            </li>
          </ul>
          {summary.errors && summary.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-trekko-blue">Ver detalhes de erros</summary>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {summary.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
