import { WindowMessenger, connect } from 'penpal'
import type { ParentApi } from '../types/viewer-api'

export function connectToViewer(iframe: HTMLIFrameElement, callbacks: ParentApi) {
  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: [window.location.origin],
  } as any)

  return connect({
    messenger,
    methods: callbacks as any,
  })
}
