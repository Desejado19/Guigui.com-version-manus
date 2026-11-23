import {
  ENTITY_KINDS,
  ENTITY_SPECS,
  ENTITY_UI,
  AUDIENCE_LABELS,
  CONTACT_PURPOSE_LABELS,
  SECTION_LABELS,
  SECTION_KEYS,
  PROFILE_FIELDS,
  PURPOSE_FIELDS,
  SECTION_FIELDS,
  SEO_FIELDS,
  type EntityKind,
  type EntityRow,
  type FieldSpec,
  type SectionKey,
  type InstitutionalDocument,
  type InstitutionalSnapshot,
  type MissingField,
} from '@/server/institutional/model'

export type { EntityKind, EntityRow, FieldSpec, SectionKey, InstitutionalDocument, InstitutionalSnapshot, MissingField }
export {
  ENTITY_KINDS,
  ENTITY_SPECS,
  ENTITY_UI,
  AUDIENCE_LABELS,
  CONTACT_PURPOSE_LABELS,
  SECTION_LABELS,
  SECTION_KEYS,
  PROFILE_FIELDS,
  PURPOSE_FIELDS,
  SECTION_FIELDS,
  SEO_FIELDS,
}

/** Cliente HTTP do módulo institucional (todas as chamadas passam por /api/admin/institutional). */

export interface InstitutionalReleaseMeta {
  id: number
  publishedAt: string | null
  publishedBy: string | null
  note?: string | null
}

export interface InstitutionalAdminMeta {
  lastPublishedAt: string | null
  lastPublishedBy: string | null
  lastReleaseId: number | null
  isDirty: boolean
  missing: MissingField[]
  canPublish: boolean
  releases: InstitutionalReleaseMeta[]
}

export interface InstitutionalAdminPayload {
  document: InstitutionalDocument
  snapshot: InstitutionalSnapshot
  meta: InstitutionalAdminMeta
}

export interface InstitutionalAuditEntry {
  id: number
  entity: string
  entityId: string | null
  action: string
  changedBy: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface InstitutionalAuditPayload {
  entries: InstitutionalAuditEntry[]
}

const BASE = '/api/admin/institutional'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof body.error === 'string'
        ? body.error
        : response.status === 401
          ? 'Sessão expirada. Volte a iniciar sessão.'
          : `O servidor respondeu com ${response.status}.`
    throw new Error(message)
  }
  return body as T
}

export function loadInstitutionalAdmin(): Promise<InstitutionalAdminPayload> {
  return request<InstitutionalAdminPayload>('')
}

export function saveProfile(data: Record<string, unknown>): Promise<{ success: boolean }> {
  return request('profile', { method: 'PUT', body: JSON.stringify(data) })
}

export function savePurpose(data: Record<string, unknown>): Promise<{ success: boolean }> {
  return request('purpose', { method: 'PUT', body: JSON.stringify(data) })
}

export function saveSeo(data: Record<string, unknown>): Promise<{ success: boolean }> {
  return request('seo', { method: 'PUT', body: JSON.stringify(data) })
}

export function saveAbout(key: SectionKey, data: Record<string, unknown>): Promise<{ success: boolean }> {
  return request(`about/${key}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function createEntity(kind: EntityKind, data: Record<string, unknown>): Promise<{ item: EntityRow }> {
  return request(`entities/${kind}`, { method: 'POST', body: JSON.stringify(data) })
}

export function updateEntity(
  kind: EntityKind,
  id: number,
  data: Record<string, unknown>,
): Promise<{ item: EntityRow }> {
  return request(`entities/${kind}/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteEntity(kind: EntityKind, id: number): Promise<{ success: boolean }> {
  return request(`entities/${kind}/${id}`, { method: 'DELETE' })
}

export function reorderEntities(kind: EntityKind, ids: number[]): Promise<{ success: boolean }> {
  return request(`entities/${kind}/reorder`, { method: 'POST', body: JSON.stringify({ ids }) })
}

export function publishInstitutional(): Promise<{ success: boolean; releaseId: number; publishedAt: string | null }> {
  return request('publish', { method: 'POST' })
}

export function restoreRelease(id: number): Promise<{ success: boolean; restoredFrom: number }> {
  return request(`releases/${id}/restore`, { method: 'POST' })
}

export function loadInstitutionalAudit(filters?: {
  entity?: string
  action?: string
  limit?: number
}): Promise<InstitutionalAuditPayload> {
  const params = new URLSearchParams()
  if (filters?.entity) params.set('entity', filters.entity)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.limit) params.set('limit', String(filters.limit))
  const query = params.toString()
  return request(`audit${query ? `?${query}` : ''}`)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o ficheiro.'))
    reader.readAsDataURL(file)
  })
}

export async function uploadInstitutionalFile(
  file: File,
  kind: 'image' | 'document' = 'image',
): Promise<{ url: string }> {
  const limitMb = kind === 'document' ? 10 : 5
  if (file.size > limitMb * 1024 * 1024) {
    throw new Error(`O ficheiro excede o limite de ${limitMb} MB.`)
  }
  const data = await readAsDataUrl(file)
  const result = await request<{ url: string }>('uploads', {
    method: 'POST',
    body: JSON.stringify({ kind, data }),
  })
  return { url: result.url }
}