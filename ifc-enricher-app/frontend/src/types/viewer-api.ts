export interface IFrameApi {
  setIfcUrls(urls: string[]): Promise<void>
  highlightElements(expressIds: number[], color?: string): Promise<void>
  clearHighlights(): Promise<void>
  zoomToElement(expressId: number): Promise<void>
  helloWorldFromIframe(): void
}

export interface ParentApi {
  onElementSelected(data: { modelKey: string; expressIds: number[] }): void
  onSelectionCleared(): void
  onModelLoaded(data: { modelKey: string }): void
  helloWorldFromWistor(): void
}
