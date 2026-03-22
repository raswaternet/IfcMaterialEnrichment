import { createContext, useContext, type ReactNode } from 'react';
import type * as OBC from '@thatopen/components';
import type * as OBF from '@thatopen/components-front';
import type { UseFragmentsManagerReturn } from '../hooks/useFragmentsManager';
import type { SelectionInfo } from '../types/viewer.types';

/**
 * Viewer context value - shared ThatOpen instances and hook returns
 */
export interface ViewerContextValue {
  components: OBC.Components | null;
  world: OBC.World | null;
  fragments: OBC.FragmentsManager | null;
  fragmentsManager: UseFragmentsManagerReturn | null;
  highlighter: OBF.Highlighter | null;
  selection: Record<string, Set<number>> | null;
  selectionInfo: SelectionInfo | null;
}

/**
 * Context for sharing ThatOpen viewer instances across components
 */
export const ViewerContext = createContext<ViewerContextValue>({
  components: null,
  world: null,
  fragments: null,
  fragmentsManager: null,
  highlighter: null,
  selection: null,
  selectionInfo: null,
});

/**
 * Hook to access viewer context
 * @throws Error if used outside ViewerProvider
 */
export const useViewerContext = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewerContext must be used within ViewerProvider');
  }
  return context;
};

/**
 * Provider props
 */
interface ViewerProviderProps {
  children: ReactNode;
  value: ViewerContextValue;
}

/**
 * Provider component for viewer context
 */
export function ViewerProvider({ children, value }: ViewerProviderProps) {
  return (
    <ViewerContext.Provider value={value}>
      {children}
    </ViewerContext.Provider>
  );
}
