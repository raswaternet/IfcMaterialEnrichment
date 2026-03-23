import { useMemo, useState } from 'react'
import { FileUpload } from './components/common/FileUpload'
import { StatusBar } from './components/common/StatusBar'
import { ElementInfo } from './components/panels/ElementInfo'
import { BsddSearch } from './components/panels/BsddSearch'
import { DraftList } from './components/panels/DraftList'
import { ReportDashboard } from './components/report/ReportDashboard'
import { ViewerIframe } from './components/viewer/ViewerIframe'
import { applyEnrichments, downloadFileUrl, getElement, getReport, rawFileUrl, uploadIfc } from './services/api'
import { useEnrichmentStore } from './store/enrichment-store'
import type { ElementDetail, ReportData, UploadSummary } from './types'

export default function App() {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [selectedElement, setSelectedElement] = useState<ElementDetail | null>(null)
  const [mode, setMode] = useState<'element' | 'search' | 'drafts' | 'report'>('element')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [enrichedFileId, setEnrichedFileId] = useState<string | null>(null)
  const { assignments, addAssignment, removeAssignment, clearAssignments } = useEnrichmentStore()

  async function handleUpload(file: File) {
    // file is already memory-backed (snapshotted in FileUpload component)
    setBusy(true)
    try {
      const summary = await uploadIfc(file)
      setUpload(summary)
      setSelectedElement(null)
      setReport(null)
      setMode('element')
      clearAssignments()
    } finally {
      setBusy(false)
    }
  }

  async function handleApply() {
    if (!upload) return
    setBusy(true)
    try {
      const result = await applyEnrichments(upload.fileId, assignments)
      setEnrichedFileId(result.enrichedFileId)
      const nextReport = await getReport(result.enrichedFileId)
      setReport(nextReport)
      setMode('report')
      clearAssignments()
    } finally {
      setBusy(false)
    }
  }

  const highlightedIds = useMemo(() => assignments.flatMap((item) => item.elementExpressIds), [assignments])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>IFC Material Enrichment</strong>
          <span>Digital Material Passport prototype</span>
        </div>
        <nav>
          <button onClick={() => setMode('element')}>Element</button>
          <button onClick={() => setMode('search')} disabled={!selectedElement}>bSDD Search</button>
          <button onClick={() => setMode('drafts')}>Drafts</button>
          <button onClick={() => setMode('report')} disabled={!report}>Report</button>
        </nav>
      </header>

      {!upload ? (
        <main className="landing"><FileUpload onUpload={handleUpload} busy={busy} /></main>
      ) : (
        <main className="workspace">
          <section className="viewer-panel">
            <ViewerIframe
              fileUrl={rawFileUrl(upload.fileId)}
              highlightedIds={highlightedIds}
              callbacks={{
                helloWorldFromWistor: () => console.log('viewer connected'),
                onSelectionCleared: () => setSelectedElement(null),
                onModelLoaded: () => console.log('model loaded'),
                onElementSelected: async ({ expressIds }) => {
                  if (!upload || expressIds.length === 0) return
                  const detail = await getElement(upload.fileId, expressIds[0])
                  setSelectedElement(detail)
                  setMode('element')
                },
              }}
            />
          </section>
          <aside className="sidebar">
            {mode === 'element' && <ElementInfo element={selectedElement} onSearch={() => setMode('search')} />}
            {mode === 'search' && <BsddSearch selectedElement={selectedElement} onAssign={(assignment) => { addAssignment(assignment); setMode('drafts') }} />}
            {mode === 'drafts' && <DraftList assignments={assignments} onRemove={removeAssignment} onApply={handleApply} busy={busy} />}
            {mode === 'report' && <ReportDashboard report={report} downloadUrl={enrichedFileId ? downloadFileUrl(enrichedFileId) : undefined} />}
          </aside>
        </main>
      )}

      <StatusBar fileName={upload?.fileName} elementCount={upload?.elementCount} enrichedCount={assignments.length} />
    </div>
  )
}
