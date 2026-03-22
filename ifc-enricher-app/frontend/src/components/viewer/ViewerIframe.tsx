import { useEffect, useRef } from 'react'
import { connectToViewer } from '../../services/viewer-bridge'
import type { ParentApi } from '../../types/viewer-api'

type ViewerProxy = {
  setIfcUrls(urls: string[]): Promise<void>
  highlightElements(expressIds: number[], color?: string): Promise<void>
  clearHighlights(): Promise<void>
}

export function ViewerIframe({ fileUrl, callbacks, highlightedIds }: { fileUrl?: string; callbacks: ParentApi; highlightedIds: number[] }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const viewerApi = useRef<ViewerProxy | null>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const connection = connectToViewer(iframeRef.current, callbacks)
    ;(connection.promise as unknown as Promise<ViewerProxy>).then((api) => {
      viewerApi.current = api
      if (fileUrl) void api.setIfcUrls([fileUrl])
    })
    return () => connection.destroy()
  }, [])

  useEffect(() => {
    if (fileUrl && viewerApi.current) void viewerApi.current.setIfcUrls([fileUrl])
  }, [fileUrl])

  useEffect(() => {
    if (!viewerApi.current) return
    if (highlightedIds.length) {
      void viewerApi.current.highlightElements(highlightedIds)
    } else {
      void viewerApi.current.clearHighlights()
    }
  }, [highlightedIds])

  return <iframe ref={iframeRef} title="IFC Viewer" src="/viewer/index.html" className="viewer-frame" />
}
