import type { BsddClassSummary, DraftAssignment, ElementDetail, ElementListItem, ReportData, UploadSummary } from '../types'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

export async function uploadIfc(file: File): Promise<UploadSummary> {
  const body = new FormData()
  body.append('file', file)
  return api('/api/upload', { method: 'POST', body })
}

/**
 * Snapshot a File into a stable Blob+name before any React re-renders
 * can invalidate the file handle. Call this in the onChange handler
 * BEFORE setting any state.
 */
export async function snapshotFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer()
  return new File([buffer], file.name, { type: file.type || 'application/octet-stream' })
}

export async function getElements(fileId: string): Promise<ElementListItem[]> {
  return api(`/api/files/${fileId}/elements`)
}

export async function getElement(fileId: string, expressId: number): Promise<ElementDetail> {
  return api(`/api/files/${fileId}/elements/${expressId}`)
}

export async function getBsddDictionaries(): Promise<{ dictionaries: Array<{ uri: string; name: string }> }> {
  return api('/api/bsdd/dictionaries')
}

export async function searchBsdd(query: string, dictionary?: string): Promise<{ classes: BsddClassSummary[] }> {
  const params = new URLSearchParams({ q: query })
  if (dictionary) params.set('dictionary', dictionary)
  return api(`/api/bsdd/search?${params.toString()}`)
}

export async function getBsddClass(uri: string): Promise<Record<string, unknown>> {
  return api(`/api/bsdd/class?uri=${encodeURIComponent(uri)}`)
}

export async function applyEnrichments(fileId: string, assignments: DraftAssignment[]) {
  return api<{ enrichedFileId: string; summary: { materialsAdded: number; elementsEnriched: number } }>(`/api/files/${fileId}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments }),
  })
}

export async function getReport(fileId: string): Promise<ReportData> {
  return api(`/api/files/${fileId}/report`)
}

export function rawFileUrl(fileId: string): string {
  return new URL(`/api/files/${fileId}/raw`, window.location.origin).toString()
}

export function downloadFileUrl(fileId: string): string {
  return `/api/files/${fileId}/download`
}
