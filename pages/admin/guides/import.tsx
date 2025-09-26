import React, { useState } from 'react'
import Papa from 'papaparse'

export default function GuideImport() {
  const [columns, setColumns] = useState<string[]>([])
  const [data, setData] = useState<any[]>([])
  const [mapping, setMapping] = useState<{ [key: string]: string }>({})
  const [preview, setPreview] = useState<any[]>([])
  const [duplicateCadastur, setDuplicateCadastur] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'commit'>('upload')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        setColumns(results.meta.fields as string[])
        setData(results.data as any[])
        setPreview((results.data as any[]).slice(0, 5))
        setStep('mapping')
      },
      error: (err: any) => setErrors([err.message])
    })
  }

  const handleMappingChange = (fieldKey: string, column: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: column }))
  }

  const runDryRun = () => {
    const missing = ['cadastur', 'name'].filter((k) => !mapping[k])
    if (missing.length > 0) {
      setErrors([`Mapeie os campos obrigatórios: ${missing.join(', ')}`])
      return
    }
    setErrors([])
    const cadasturValues: Record<string, number> = {}
    const duplicates: string[] = []
    data.forEach((row) => {
      const cad = row[mapping['cadastur']]
      if (cad) cadasturValues[cad] = (cadasturValues[cad] || 0) + 1
    })
    Object.keys(cadasturValues).forEach((cad) => {
      if (cadasturValues[cad] > 1) duplicates.push(cad)
    })
    setDuplicateCadastur(duplicates)
    setStep('preview')
  }

  const commit = () => {
    alert('Importação confirmada! (stub)')
    setStep('commit')
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-4">Importar Guias (Cadastur)</h1>
      {step === 'upload' && (
        <div className="space-y-4">
          <p>Faça upload do arquivo CSV exportado do Cadastur.</p>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="border p-2" />
          {errors.length > 0 && <div className="text-red-600">{errors.map((e) => <p key={e}>{e}</p>)}</div>}
        </div>
      )}
      {step === 'mapping' && (
        <div className="space-y-4">
          <p>Mapeie as colunas do CSV com os campos do sistema.</p>
          {['cadastur', 'name', 'email', 'phone', 'uf', 'city', 'validity', 'specialties'].map((field) => (
            <div key={field} className="flex items-center gap-2">
              <label className="w-32 capitalize">{field}</label>
              <select
                value={mapping[field] || ''}
                onChange={(e) => handleMappingChange(field, e.target.value)}
                className="border p-2 flex-1"
              >
                <option value="">Selecione...</option>
                {columns.map((col) => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
          ))}
          <button onClick={runDryRun} className="mt-4 bg-trekko-yellow text-black hover:brightness-95 px-4 py-2 rounded">
            Dry Run
          </button>
          {errors.length > 0 && <div className="text-red-600">{errors.map((e) => <p key={e}>{e}</p>)}</div>}
        </div>
      )}
      {step === 'preview' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Pré-visualização</h2>
          {duplicateCadastur.length > 0 && <div className="text-red-600"><p>Cadastur duplicados: {duplicateCadastur.join(', ')}</p></div>}
          <div className="overflow-auto border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['cadastur', 'name', 'email', 'phone', 'uf', 'city', 'validity', 'specialties'].map((field) => (
                    <th key={field} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.map((row, idx) => (
                  <tr key={idx} className={duplicateCadastur.includes(row[mapping['cadastur']]) ? 'bg-red-50' : ''}>
                    {['cadastur', 'name', 'email', 'phone', 'uf', 'city', 'validity', 'specialties'].map((field) => (
                      <td key={field} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{row[mapping[field]] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={commit} className="bg-trekko-yellow text-black hover:brightness-95 px-4 py-2 rounded">
            Importar
          </button>
        </div>
      )}
      {step === 'commit' && (
        <div>
          <h2 className="text-2xl font-semibold">Importação concluída!</h2>
          <p>Os guias foram importados com sucesso.</p>
        </div>
      )}
    </div>
  )
}
