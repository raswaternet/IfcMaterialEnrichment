import { useRef, useState } from 'react'

type Props = {
  onUpload: (file: File) => void
  busy: boolean
}

/**
 * Read a File into a memory-backed File immediately,
 * so it survives React re-renders and input resets.
 */
function readFileToMemory(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer
      resolve(new File([buffer], file.name, { type: file.type || 'application/octet-stream' }))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

export function FileUpload({ onUpload, busy }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file || busy) return
    // Read into memory IMMEDIATELY — before any parent state changes
    try {
      const stableFile = await readFileToMemory(file)
      onUpload(stableFile)
    } catch (e) {
      console.error('Failed to read file:', e)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.toLowerCase().endsWith('.ifc')) {
      void handleFile(file)
    }
  }

  return (
    <div className="upload-card">
      <h1>🏗️ IFC Material Enrichment</h1>
      <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '480px', margin: '0 auto 16px' }}>
        Upload an IFC model, enrich elements with standardized materials from bSDD, and export a Digital Material Passport.
      </p>
      <div
        className="upload-dropzone"
        style={{
          borderColor: dragging ? 'var(--accent, #5eead4)' : undefined,
          background: dragging ? 'var(--accent-bg, rgba(94,234,212,0.05))' : undefined,
        }}
        onClick={() => !busy && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span style={{ fontSize: '32px' }}>📂</span>
        <strong>{busy ? '⏳ Uploading & parsing…' : 'Drop IFC file here or click to browse'}</strong>
        <span style={{ fontSize: '13px' }}>.ifc files only</span>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".ifc"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          void handleFile(file)
        }}
      />
    </div>
  )
}
