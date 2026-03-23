import type { ReportData } from '../../types'

export function ReportDashboard({ report, downloadUrl }: { report: ReportData | null; downloadUrl?: string }) {
  if (!report) {
    return (
      <div className="panel">
        <h3>📊 Report</h3>
        <p style={{ color: '#94a3b8' }}>Apply enrichments to generate a material report.</p>
      </div>
    )
  }

  const completenessColor = report.completeness > 0.5 ? '#22c55e' : report.completeness > 0.1 ? '#f59e0b' : '#ef4444'
  const totalVolume = report.materials.reduce((sum, m) => sum + (m.totalVolume || 0), 0)

  function exportCsv() {
    const headers = ['Material', 'Category', 'Element Count', 'Element Types', 'Total Volume (m³)']
    const rows = report!.materials.map((m) => [
      m.name,
      m.category || '',
      m.elementCount,
      (m.elementTypes || []).join('; '),
      m.totalVolume?.toFixed(4) ?? '',
    ])
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'material-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel">
      <h3>📊 Material Report</h3>

      <div className="report-summary">
        <div>
          <strong>{report.totalElements}</strong>
          <span>Total elements</span>
        </div>
        <div>
          <strong style={{ color: '#5eead4' }}>{report.enrichedElements}</strong>
          <span>Enriched</span>
        </div>
        <div>
          <strong style={{ color: completenessColor }}>{(report.completeness * 100).toFixed(1)}%</strong>
          <span>Completeness</span>
        </div>
      </div>

      {totalVolume > 0 && (
        <div style={{ background: '#111927', padding: '12px', borderRadius: '12px', marginBottom: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Total material volume</span>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} m³</div>
        </div>
      )}

      <h4>Materials</h4>
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Category</th>
            <th>Count</th>
            <th>Volume (m³)</th>
          </tr>
        </thead>
        <tbody>
          {report.materials.map((item) => (
            <tr key={item.name}>
              <td><strong>{item.name}</strong></td>
              <td style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{item.category || '—'}</td>
              <td>{item.elementCount}</td>
              <td>{item.totalVolume ? item.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Material distribution bar */}
      {report.materials.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h5 style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Distribution by element count</h5>
          <div style={{ display: 'flex', height: '24px', borderRadius: '8px', overflow: 'hidden' }}>
            {report.materials.map((m, i) => {
              const pct = (m.elementCount / report.enrichedElements) * 100
              const colors = ['#5eead4', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#818cf8']
              return (
                <div
                  key={m.name}
                  title={`${m.name}: ${m.elementCount} elements (${pct.toFixed(1)}%)`}
                  style={{
                    width: `${pct}%`,
                    background: colors[i % colors.length],
                    minWidth: '2px',
                  }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {report.materials.map((m, i) => {
              const colors = ['#5eead4', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#818cf8']
              return (
                <span key={m.name} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: colors[i % colors.length], display: 'inline-block' }} />
                  {m.name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {report.unenrichedElements.length > 0 && (
        <details style={{ marginTop: '16px' }}>
          <summary style={{ cursor: 'pointer', color: '#f59e0b', fontSize: '13px' }}>
            ⚠️ {report.unenrichedElements.length} unenriched elements
          </summary>
          <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px' }}>
            {report.unenrichedElements.slice(0, 50).map((el) => (
              <div key={el.expressId} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#94a3b8' }}>{el.ifcType}</span>
                <span style={{ marginLeft: '8px' }}>{el.name || `#${el.expressId}`}</span>
              </div>
            ))}
            {report.unenrichedElements.length > 50 && (
              <p style={{ color: '#64748b', fontSize: '12px' }}>…and {report.unenrichedElements.length - 50} more</p>
            )}
          </div>
        </details>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {downloadUrl && (
          <a className="primary link-button" href={downloadUrl} style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
            ⬇️ Download enriched IFC
          </a>
        )}
        <button onClick={exportCsv} style={{ flex: 1 }}>
          📄 Export CSV
        </button>
      </div>
    </div>
  )
}
