export type UploadSummary = {
  fileId: string
  fileName: string
  schema?: string
  elementCount: number
  elementTypes: string[]
}

export type ElementListItem = {
  expressId: number
  globalId?: string
  name?: string
  ifcType: string
  hasGeometry: boolean
  hasMaterial: boolean
}

export type ElementDetail = {
  expressId: number
  globalId?: string
  name?: string
  ifcType: string
  properties: Record<string, unknown>
  quantities: Record<string, unknown>
  material?: Record<string, unknown> | null
}

export type BsddClassSummary = {
  uri?: string
  name?: string
  dictionaryName?: string
  description?: string
}

export type DraftAssignment = {
  id: string
  elementExpressIds: number[]
  label: string
  materialName: string
  materialCategory?: string
  materialDescription?: string
  bsddClassUri?: string
  properties?: Record<string, { value: string | number; unit?: string }>
}

export type ReportData = {
  totalElements: number
  enrichedElements: number
  completeness: number
  materials: Array<{
    name: string
    category?: string
    elementCount: number
    elementTypes: string[]
    totalVolume: number
    estimatedMass?: number | null
    co2Estimate?: number | null
  }>
  unenrichedElements: ElementListItem[]
}
