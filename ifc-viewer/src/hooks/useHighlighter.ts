import { useEffect, useRef, useState, useCallback } from 'react';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import type { ViewerCore, SelectionInfo } from '../types/viewer.types';

export interface UseHighlighterReturn {
  /** Highlighter instance */
  highlighter: OBF.Highlighter | null;
  /** Current selection map (modelId -> Set of localIds) */
  selection: Record<string, Set<number>> | null;
  /** Selection info for UI display */
  selectionInfo: SelectionInfo | null;
}

/**
 * Custom hook for managing object highlighting and selection
 * 
 * Handles:
 * - Highlighter initialization
 * - Selection state tracking
 * - Event bridging from ThatOpen to React
 * - Selection info aggregation
 */
export function useHighlighter(viewerCore: ViewerCore | null): UseHighlighterReturn {
  const [selection, setSelection] = useState<Record<string, Set<number>> | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const highlighterRef = useRef<OBF.Highlighter | null>(null);
  const initializedRef = useRef(false);

  /**
   * Update selection info from current selection
   */
  const updateSelectionInfo = useCallback((currentSelection: Record<string, Set<number>> | null) => {
    if (!currentSelection || Object.keys(currentSelection).length === 0) {
      setSelectionInfo(null);
      return;
    }

    // Count total selected objects
    let totalCount = 0;
    const details: Record<string, number> = {};

    for (const [modelId, ids] of Object.entries(currentSelection)) {
      const count = ids.size;
      totalCount += count;
      details[modelId] = count;
    }

    setSelectionInfo({
      totalCount,
      modelCount: Object.keys(currentSelection).length,
      details,
    });
  }, []);

  /**
   * Update selection from highlighter
   */
  const updateSelectionFromHighlighter = useCallback(() => {
    if (!highlighterRef.current) return;

    const currentSelection = highlighterRef.current.selection.select as Record<string, Set<number>> | undefined;

    if (!currentSelection || Object.keys(currentSelection).length === 0) {
      setSelection(null);
      setSelectionInfo(null);
      return;
    }

    setSelection(currentSelection);
    updateSelectionInfo(currentSelection);
  }, [updateSelectionInfo]);

  // Initialize Highlighter
  useEffect(() => {
    if (!viewerCore || initializedRef.current) return;

    const init = async () => {
      try {
        const { components, world } = viewerCore;

        // Initialize Raycasters first (required for Highlighter)
        const raycasters = components.get(OBC.Raycasters);
        raycasters.get(world);

        // Get Highlighter
        const highlighter = components.get(OBF.Highlighter);
        await highlighter.setup({ world });

        // Ensure highlighter is fully configured before exposing it
        highlighterRef.current = highlighter;

        // Listen for selection events
        highlighter.events.select.onHighlight.add(() => {
          updateSelectionFromHighlighter();
        });

        highlighter.events.select.onClear.add(() => {
          setSelection(null);
          setSelectionInfo(null);
        });

        initializedRef.current = true;
      } catch (err) {
        console.error('[useHighlighter] Error initializing highlighter:', err);
      }
    };

    init();

    return () => {
      // Cleanup if needed
      if (highlighterRef.current) {
        highlighterRef.current.dispose();
      }
    };
  }, [viewerCore, updateSelectionFromHighlighter]);

  return {
    highlighter: highlighterRef.current,
    selection,
    selectionInfo,
  };
}
