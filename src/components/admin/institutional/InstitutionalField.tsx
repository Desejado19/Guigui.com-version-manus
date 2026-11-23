import React, { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { uploadInstitutionalFile, type FieldSpec } from './institutionalApi'

const inputClass =
  'w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-[var(--color-green-900)] focus:bg-[var(--color-bg-surface)] focus:ring-2 focus:ring-[var(--color-green-900)]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

export const InstitutionalField: React.FC<{
  label: string
  spec: FieldSpec
  value: string | boolean
  onChange: (value: string | boolean) => void
  options?: Array<{ value: string; label: string }>
  uploadKind?: 'image' | 'document'
  hint?: string
}> = ({ label, spec, value, onChange, options, uploadKind, hint }) => {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const result = await uploadInstitutionalFile(file, uploadKind ?? 'image')
      onChange(result.url)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Falha no carregamento.')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const control = () => {
    if (spec.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border-default)]"
          />
          {label}
        </label>
      )
    }
    if (spec.type === 'enum') {
      const choices = options ?? (spec.values ?? []).map((item) => ({ value: item, label: item }))
      return (
        <select
          className={inputClass}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecionar…</option>
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
    if (spec.type === 'textarea') {
      return (
        <textarea
          rows={4}
          maxLength={spec.max}
          className={`${inputClass} resize-y`}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    }
    if (spec.type === 'color') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="h-9 w-12 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]"
            value={String(value || '#0B3B37')}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            className={inputClass}
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <input
          type={spec.type === 'date' ? 'date' : spec.type === 'year' ? 'number' : spec.type === 'url' ? 'url' : spec.type === 'email' ? 'email' : 'text'}
          maxLength={spec.type === 'text' ? spec.max : undefined}
          className={inputClass}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={spec.type === 'url' ? 'https://…' : undefined}
        />
        {uploadKind && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={uploadKind === 'document' ? 'application/pdf' : 'image/png,image/jpeg,image/webp'}
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2.5 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600 transition:hover:border-[var(--color-green-900)] hover:text-[var(--color-green-900)] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'A enviar' : 'Carregar'}
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={spec.type === 'textarea' ? 'sm:col-span-2' : ''}>
      {spec.type !== 'boolean' && (
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </label>
      )}
      {control()}
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
      {uploadError && <p className="mt-1 text-[10px] font-bold text-rose-600">{uploadError}</p>}
    </div>
  )
}