import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { InstitutionalField } from './InstitutionalField'
import {
  AUDIENCE_LABELS,
  CONTACT_PURPOSE_LABELS,
  ENTITY_SPECS,
  ENTITY_UI,
  createEntity,
  deleteEntity,
  reorderEntities,
  updateEntity,
  type EntityKind,
  type EntityRow,
} from './institutionalApi'

/** Campo usado como título de cada registo na lista. */
const TITLE_FIELD: Record<EntityKind, string> = {
  values: 'name',
  timeline: 'title',
  objectives: 'title',
  team: 'name',
  departments: 'name',
  partners: 'name',
  contacts: 'label',
  social_links: 'label',
  gallery: 'title',
  faq: 'question',
  documents: 'name',
  services: 'name',
  communications: 'title',
  assets: 'label',
}

const emptyDraft = (kind: EntityKind): Record<string, string> => {
  const draft: Record<string, string> = {}
  for (const [key, field] of Object.entries(ENTITY_SPECS[kind].fields)) {
    draft[key] = field.type === 'enum' && field.values?.length ? field.values[0] : ''
  }
  return draft
}

export const InstitutionalEntityPanel: React.FC<{
  kind: EntityKind
  rows: EntityRow[]
  onChanged: () => Promise<void> | void
  onFeedback: (message: string, tone?: 'ok' | 'error') => void
}> = ({ kind, rows, onChanged, onFeedback }) => {
  const ui = ENTITY_UI[kind]
  const spec = ENTITY_SPECS[kind]
  const titleField = TITLE_FIELD[kind]
  const uploads: Record<string, 'image' | 'document'> = 'uploads' in ui ? ui.uploads : {}
  const [editing, setEditing] = useState<EntityRow | 'new' | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>(() => emptyDraft(kind))
  const [visible, setVisible] = useState(true)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      Object.keys(spec.fields).some((key) => String(row[key] ?? '').toLowerCase().includes(term)),
    )
  }, [query, rows, spec.fields])

  const openNew = () => {
    setDraft(emptyDraft(kind))
    setVisible(true)
    setEditing('new')
  }

  const openEdit = (row: EntityRow) => {
    const next: Record<string, string> = {}
    for (const key of Object.keys(spec.fields)) next[key] = String(row[key] ?? '')
    setDraft(next)
    setVisible(row.isVisible !== false)
    setEditing(row)
  }

  const submit = async () => {
    setBusy(true)
    try {
      if (editing === 'new') {
        await createEntity(kind, { ...draft, isVisible: visible })
        onFeedback('Registo criado.')
      } else if (editing) {
        await updateEntity(kind, editing.id, { ...draft, isVisible: visible })
        onFeedback('Registo guardado.')
      }
      setEditing(null)
      await onChanged()
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Operação falhou.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: EntityRow) => {
    if (!window.confirm(`Eliminar "${String(row[titleField] ?? ui.singular)}"?`)) return
    setBusy(true)
    try {
      await deleteEntity(kind, row.id)
      onFeedback('Registo eliminado.')
      await onChanged()
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Não foi possível eliminar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const move = async (row: EntityRow, direction: -1 | 1) => {
    const index = rows.findIndex((item) => item.id === row.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= rows.length) return
    const ordered = [...rows]
    const [moved] = ordered.splice(index, 1)
    ordered.splice(target, 0, moved)
    setBusy(true)
    try {
      await reorderEntities(kind, ordered.map((item) => item.id))
      await onChanged()
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Não foi possível reordenar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleVisibility = async (row: EntityRow) => {
    setBusy(true)
    try {
      const payload: Record<string, unknown> = { isVisible: row.isVisible === false }
      for (const key of Object.keys(spec.fields)) payload[key] = String(row[key] ?? '')
      await updateEntity(kind, row.id, payload)
      await onChanged()
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Não foi possível alterar a visibilidade.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const enumOptions = (key: string) => {
    if (key === 'audience') return Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({ value, label }))
    if (key === 'purpose') return Object.entries(CONTACT_PURPOSE_LABELS).map(([value, label]) => ({ value, label }))
    return undefined
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pesquisar…"
          aria-label="Pesquisar registos"
          className="min-w-[180px] flex-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-2 text-[11px] font-medium text-slate-700 outline-none focus:border-[var(--color-green-900)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <Button type="button" size="sm" onClick={openNew} disabled={busy}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar {ui.singular}
        </Button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-[var(--color-green-900)]/30 bg-[var(--color-bg-surface)] p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900">
          <h3 className="text-[12px] font-black text-slate-900 dark:text-white">
            {editing === 'new' ? `Novo ${ui.singular}` : `Editar ${ui.singular}`}
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(spec.fields).map(([key, field]) => (
              <InstitutionalField
                key={key}
                label={ui.fieldLabels[key] ?? key}
                spec={field}
                value={draft[key] ?? ''}
                onChange={(value) => setDraft((prev) => ({ ...prev, [key]: String(value) }))}
                options={enumOptions(key)}
                uploadKind={uploads[key]}
              />
            ))}
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => setVisible(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border-default)]"
              />
              Visível na página pública
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
              {busy ? 'A guardar…' : 'Guardar'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[560px] text-left text-[11px]">
          <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="p-2.5">Ordem</th>
              <th className="p-2.5">{ui.fieldLabels[titleField] ?? titleField}</th>
              <th className="p-2.5">Estado</th>
              <th className="p-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-[11px] font-semibold text-slate-500">
                  Sem registos. Adicione o primeiro {ui.singular}.
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-border-subtle)] dark:border-slate-800">
                <td className="p-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={busy}
                      onClick={() => void move(row, -1)}
                      className="rounded-md border border-[var(--color-border-subtle)] p-1 text-slate-500 disabled:opacity-40 dark:border-slate-700"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      disabled={busy}
                      onClick={() => void move(row, 1)}
                      className="rounded-md border border-[var(--color-border-subtle)] p-1 text-slate-500 disabled:opacity-40 dark:border-slate-700"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                  {String(row[titleField] ?? '—')}
                </td>
                <td className="p-2.5">
                  <button
                    type="button"
                    onClick={() => void toggleVisibility(row)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${row.isVisible === false ? 'border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-slate-500 dark:border-slate-700 dark:bg-slate-800' : 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'}`}
                  >
                    {row.isVisible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {row.isVisible === false ? 'Oculto' : 'Visível'}
                  </button>
                </td>
                <td className="p-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => openEdit(row)}>
                      Editar
                    </Button>
                    <button
                      type="button"
                      aria-label="Eliminar"
                      disabled={busy}
                      onClick={() => void remove(row)}
                      className="rounded-lg border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] p-1.5 text-[var(--tone-danger-text)] transition hover:bg-[var(--tone-danger-bg)] disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] font-bold text-slate-500">
        {rows.length} registo(s) · os itens ocultos continuam guardados mas não aparecem na página pública.
      </p>
    </div>
  )
}