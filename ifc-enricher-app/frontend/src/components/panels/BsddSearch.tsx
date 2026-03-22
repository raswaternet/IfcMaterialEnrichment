import { useEffect, useState } from 'react'
import { getBsddClass, getBsddDictionaries, searchBsdd } from '../../services/api'
import type { BsddClassSummary, DraftAssignment, ElementDetail } from '../../types'

interface DictOption {
  uri: string
  name: string
}

interface ClassProperty {
  name?: string
  dataType?: string
  description?: string
  unit?: string
  predefinedValue?: string
}

export function BsddSearch({ selectedElement, onAssign }: { selectedElement: ElementDetail | null; onAssign: (assignment: DraftAssignment) => void }) {
  // Dictionary selection state
  const [allDictionaries, setAllDictionaries] = useState<DictOption[]>([])
  const [mainDictionary, setMainDictionary] = useState('')
  const [dictsLoading, setDictsLoading] = useState(true)

  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BsddClassSummary[]>([])
  const [selected, setSelected] = useState<Record<string, any> | null>(null)
  const [materialName, setMaterialName] = useState('')
  const [loading, setLoading] = useState(false)

  // Load dictionaries on mount
  useEffect(() => {
    ;(async () => {
      try {
        const response = await getBsddDictionaries()
        const dicts = (response.dictionaries || []).map((d: any) => ({
          uri: d.uri,
          name: `${d.name}${d.version ? ` (${d.version})` : ''}`,
        }))
        setAllDictionaries(dicts)

        // Default to IFC 4.3 if available
        const ifcDict = dicts.find((d: DictOption) => d.uri.includes('buildingsmart/ifc/4.3'))
        if (ifcDict) setMainDictionary(ifcDict.uri)
      } finally {
        setDictsLoading(false)
      }
    })()
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await searchBsdd(query, mainDictionary || undefined)
        setResults(response.classes || [])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query, mainDictionary])

  async function pick(item: BsddClassSummary) {
    if (!item.uri) return
    setLoading(true)
    try {
      const detail = await getBsddClass(item.uri)
      setSelected(detail)
      setMaterialName(item.name || '')
    } finally {
      setLoading(false)
    }
  }

  function extractProperties(): Record<string, { value: number | string; unit?: string }> {
    if (!selected) return {}
    const props: Record<string, { value: number | string; unit?: string }> = {}
    const classProps: ClassProperty[] = selected.classProperties || selected.ClassProperties || []
    for (const p of classProps) {
      if (p.predefinedValue && p.name) {
        const num = parseFloat(p.predefinedValue)
        props[p.name] = { value: isNaN(num) ? p.predefinedValue : num, unit: p.unit }
      }
    }
    return props
  }

  const classProperties: ClassProperty[] = selected?.classProperties || selected?.ClassProperties || []
  const keyProps = classProperties.filter(p =>
    ['MassDensity', 'CO2Content', 'CompressiveStrength', 'Porosity', 'SpecificHeatCapacity'].includes(p.name || '')
  )
  const otherProps = classProperties.filter(p =>
    !['MassDensity', 'CO2Content', 'CompressiveStrength', 'Porosity', 'SpecificHeatCapacity'].includes(p.name || '')
  )

  return (
    <div className="panel">
      <h3>🔍 bSDD Material Search</h3>

      {!selectedElement && <p style={{ color: '#f59e0b' }}>Select an element in the viewer first.</p>}

      {/* Dictionary Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Dictionary</label>
        <select
          value={mainDictionary}
          onChange={(e) => { setMainDictionary(e.target.value); setResults([]); setSelected(null) }}
          disabled={dictsLoading}
          style={{
            width: '100%', padding: '10px', background: '#0b1118', color: '#e8eef8',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', fontSize: '13px',
          }}
        >
          <option value="">All dictionaries</option>
          {allDictionaries.map((d) => (
            <option key={d.uri} value={d.uri}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Search Input */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a class (e.g., concrete, wall, beam)"
      />

      {loading && <p style={{ color: '#94a3b8', fontSize: '13px' }}>Searching…</p>}

      {/* Search Results */}
      <div className="search-results">
        {results.map((item) => (
          <button
            key={item.uri}
            className={`search-result ${selected && (selected.uri === item.uri || selected.Uri === item.uri) ? 'selected' : ''}`}
            onClick={() => pick(item)}
          >
            <div>
              <strong>{item.name}</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block' }}>{item.dictionaryName}</span>
              {item.description && (
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                  {item.description.slice(0, 120)}{item.description.length > 120 ? '…' : ''}
                </span>
              )}
            </div>
          </button>
        ))}
        {!loading && query && results.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '13px' }}>No results found in this dictionary.</p>
        )}
      </div>

      {/* Selected Class Detail */}
      {selected && (
        <div className="material-detail" style={{ marginTop: '16px' }}>
          <h4>📋 {selected.name || selected.Name}</h4>
          {(selected.description || selected.Description) && (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 12px' }}>
              {(selected.description || selected.Description || '').slice(0, 200)}
            </p>
          )}

          {/* bSDD URI */}
          <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', marginBottom: '8px' }}>
            URI: {selected.uri || selected.Uri}
          </div>

          {/* Key Properties */}
          {keyProps.length > 0 && (
            <>
              <h5 style={{ margin: '8px 0 4px', color: '#5eead4' }}>Key Properties</h5>
              <dl className="detail-grid">
                {keyProps.map((p) => (
                  <div key={p.name}>
                    <dt>{p.name}</dt>
                    <dd>{p.predefinedValue || p.dataType || '—'}{p.unit ? ` ${p.unit}` : ''}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {/* All Properties (collapsible) */}
          {otherProps.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}>
                All properties ({classProperties.length})
              </summary>
              <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: '8px' }}>
                {otherProps.map((p) => (
                  <div key={p.name} style={{ fontSize: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ color: '#94a3b8' }}>{p.name}</span>
                    <span style={{ marginLeft: '8px' }}>{p.dataType || ''}</span>
                    {p.description && <span style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>{p.description.slice(0, 100)}</span>}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Assign to Element */}
          {selectedElement && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#111927', borderRadius: '12px' }}>
              <h5 style={{ margin: '0 0 8px' }}>Assign to: {selectedElement.name || selectedElement.ifcType}</h5>
              <label style={{ fontSize: '12px', color: '#94a3b8' }}>Material name</label>
              <input value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
              <button
                className="primary"
                style={{ width: '100%' }}
                disabled={!materialName.trim()}
                onClick={() => onAssign({
                  id: `${selectedElement.expressId}:${materialName}`,
                  elementExpressIds: [selectedElement.expressId],
                  label: `${selectedElement.name || selectedElement.ifcType} → ${materialName}`,
                  materialName,
                  materialCategory: (selected.classType || selected.ClassType || 'material').toLowerCase(),
                  materialDescription: selected.description || selected.Description || '',
                  bsddClassUri: selected.uri || selected.Uri,
                  properties: extractProperties(),
                })}
              >
                Assign material
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
