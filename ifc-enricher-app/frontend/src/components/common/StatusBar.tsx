export function StatusBar({ fileName, elementCount, enrichedCount }: { fileName?: string; elementCount?: number; enrichedCount: number }) {
  return (
    <div className="status-bar">
      <span>{fileName || 'No file loaded'}</span>
      <span>{elementCount ?? 0} elements</span>
      <span>{enrichedCount} draft assignments</span>
    </div>
  )
}
