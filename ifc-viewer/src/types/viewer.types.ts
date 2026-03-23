import type * as OBC from '@thatopen/components';
import type { PostproductionRenderer } from '@thatopen/components-front';

/**
 * Selection map: modelId -> Set of localIds
 */
export type SelectionMap = Record<string, Set<number>>;

/**
 * Classification store: label -> Set of GUIDs
 */
export type ClassificationStore = Map<string, Set<string>>;

/**
 * Model info for UI display
 */
export interface ModelInfo {
  id: string;
  name: string;
  ifcFileName?: string;
  itemCount?: number;
}

/**
 * Selection info for UI display
 */
export interface SelectionInfo {
  totalCount: number;
  modelCount: number;
  details: Record<string, number>;
}

/**
 * Viewer core components
 */
export interface ViewerCore {
  components: OBC.Components;
  world: OBC.World;
  renderer: PostproductionRenderer;
  camera: OBC.SimpleCamera;
}

/**
 * Fragments manager state
 */
export interface FragmentsManagerState {
  fragments: OBC.FragmentsManager;
  models: ModelInfo[];
  isLoading: boolean;
}

/**
 * Highlighter state
 */
export interface HighlighterState {
  highlighter: OBF.Highlighter;
  selection: SelectionMap;
  selectionInfo: SelectionInfo | null;
}

/**
 * Classification state
 */
export interface ClassificationState {
  labels: string[];
  activeLabel: string | null;
  store: ClassificationStore;
}

/**
 * Rectangle selection mode
 */
export type SelectionMode = 'single' | 'window' | 'crossing';

/**
 * Rectangle selection state
 */
export interface RectangleSelectionState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  mode: SelectionMode;
  additive: boolean;
}
