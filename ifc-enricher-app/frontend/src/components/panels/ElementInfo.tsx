import type { ElementDetail } from '../../types'

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') return val.toLocaleString(undefined, { maximumFractionDigits: 4 })
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export function ElementInfo({ element, onSearch }: { element: ElementDetail | null; onSearch: () => void }) {
  if (!element) {
    return (
      <div className="panel">
        <h3>No element selected</h3>
        <p style={{ color: '#94a3b8' }}>Click on an object in the 3D viewer to inspect its properties and assign materials.</p>
      </div>
    )
  }

  const material = element.material as Record<string, unknown> | null | undefined
  const quantities = element.quantities as Record<string, Record<string, unknown>> | undefined
  const properties = element.properties as Record<string, Record<string, unknown>> | undefined

  return (
    <div className="panel">
      <h3>{element.name || 'Unnamed element'}</h3>

      <dl className="detail-grid">
        <div><dt>IFC type</dt><dd>{element.ifcType}</dd></div>
        <div><dt>Express ID</dt><dd>{element.expressId}</dd></div>
        <div><dt>Global ID</dt><dd style={{ fontSize: '11px', wordBreak: 'break-all' }}>{element.globalId || '—'}</dd></div>
        <div>
          <dt>Material</dt>
          <dd style={{ color: material?.name ? '#5eead4' : '#f59e0b' }}>
            {(material?.name as string) || 'None assigned'}
          </dd>
        </div>
      </dl>

      <button className="primary" style={{ width: '100%', marginTop: '12px' }} onClick={onSearch}>
        🔍 Search Material in bSDD
      </button>

      {quantities && Object.keys(quantities).length > 0 && (
        <>
          <h4 style={{ marginTop: '16px' }}>📐 Quantities</h4>
          {Object.entries(quantities).map(([qtoName, qtoProps]) => (
            <div key={qtoName} style={{ marginBottom: '8px' }}>
              <h5 style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0' }}>{qtoName}</h5>
              <dl className="detail-grid">
                {Object.entries(qtoProps)
                  .filter(([key]) => key !== 'id')
                  .map(([key, val]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{formatValue(val)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </>
      )}

      {properties && Object.keys(properties).length > 0 && (
        <details style={{ marginTop: '16px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            🏷️ Property Sets ({Object.keys(properties).length})
          </summary>
          {Object.entries(properties).map(([psetName, psetProps]) => (
            <div key={psetName} style={{ marginTop: '8px' }}>
              <h5 style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0' }}>{psetName}</h5>
              <dl className="detail-grid">
                {Object.entries(psetProps)
                  .filter(([key]) => key !== 'id')
                  .map(([key, val]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{formatValue(val)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
