import type { DraftAssignment } from '../../types'

export function DraftList({
  assignments,
  onRemove,
  onApply,
  busy,
}: {
  assignments: DraftAssignment[]
  onRemove: (id: string) => void
  onApply: () => void
  busy: boolean
}) {
  const totalElements = assignments.reduce((sum, a) => sum + a.elementExpressIds.length, 0)
  const uniqueMaterials = new Set(assignments.map((a) => a.materialName.toLowerCase()))

  return (
    <div className="panel">
      <h3>📝 Draft Enrichments</h3>

      {assignments.length > 0 && (
        <div className="report-summary" style={{ marginBottom: '12px' }}>
          <div>
            <strong>{assignments.length}</strong>
            <span>Assignments</span>
          </div>
          <div>
            <strong>{totalElements}</strong>
            <span>Elements</span>
          </div>
          <div>
            <strong>{uniqueMaterials.size}</strong>
            <span>Materials</span>
          </div>
        </div>
      )}

      <div className="draft-list">
        {assignments.length === 0 && (
          <p style={{ color: '#94a3b8' }}>
            No pending assignments yet. Select an element in the viewer and search for a material in bSDD to get started.
          </p>
        )}
        {assignments.map((assignment) => (
          <div key={assignment.id} className="draft-item">
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#5eead4' }}>{assignment.materialName}</strong>
              {assignment.materialCategory && (
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px', textTransform: 'uppercase' }}>
                  {assignment.materialCategory}
                </span>
              )}
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>{assignment.label}</p>
            </div>
            <button
              onClick={() => onRemove(assignment.id)}
              style={{ flexShrink: 0, fontSize: '12px' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        className="primary"
        style={{ width: '100%', marginTop: '16px', padding: '14px' }}
        disabled={assignments.length === 0 || busy}
        onClick={onApply}
      >
        {busy ? '⏳ Applying enrichments…' : `Apply & Export (${assignments.length} assignments)`}
      </button>
    </div>
  )
}
