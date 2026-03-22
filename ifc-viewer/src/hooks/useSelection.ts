import { useEffect, useRef, useCallback, useState } from 'react';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import type { ViewerCore, SelectionInfo } from '../types/viewer.types';
import {
  SelectionManager,
  applyRectangleSelection,
  applyModifier,
  commitSelection,
} from '../selection';
import type { SelectionModifier } from '../selection';

type SelectionMap = Record<string, Set<number>>;

export interface UseSelectionOptions {
  /** Minimum drag distance (pixels) before starting rectangular selection @default 5 */
  dragThreshold?: number;
}

export interface UseSelectionReturn {
  /** Highlighter instance (needed by other consumers, e.g. classification panel) */
  highlighter: OBF.Highlighter | null;
  /** Current selection map (modelId → Set of localIds), null when empty */
  selection: SelectionMap | null;
  /** Aggregated selection info for UI display */
  selectionInfo: SelectionInfo | null;
}

/**
 * Unified selection hook — owns Highlighter init, click selection,
 * rectangle selection, and modifier handling (add / toggle / subtract).
 *
 * Replaces the previous useHighlighter + useRectangularSelection pair.
 *
 * Key design: We disable the Highlighter's built-in `multiple` behavior
 * (which only supports ctrlKey) and handle ALL modifier logic ourselves.
 * This gives us full control over the SketchUp-style key mapping:
 *   Ctrl = add, Shift = toggle, Shift+Option/Ctrl = subtract
 */
export function useSelection(
  viewerCore: ViewerCore | null,
  options: UseSelectionOptions = {},
): UseSelectionReturn {
  const { dragThreshold = 5 } = options;

  const [selection, setSelection] = useState<SelectionMap | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  const highlighterRef = useRef<OBF.Highlighter | null>(null);
  const managerRef = useRef<SelectionManager | null>(null);
  const initRef = useRef(false);

  // -----------------------------------------------------------------------
  // Selection state helpers
  // -----------------------------------------------------------------------

  const publishSelection = useCallback((sel: SelectionMap | null) => {
    if (!sel || Object.keys(sel).length === 0) {
      setSelection(null);
      setSelectionInfo(null);
      return;
    }
    setSelection(sel);

    let totalCount = 0;
    const details: Record<string, number> = {};
    for (const [modelId, ids] of Object.entries(sel)) {
      totalCount += ids.size;
      details[modelId] = ids.size;
    }
    setSelectionInfo({
      totalCount,
      modelCount: Object.keys(sel).length,
      details,
    });
  }, []);

  // -----------------------------------------------------------------------
  // Init Highlighter + SelectionManager
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!viewerCore || initRef.current) return;

    const { components, world } = viewerCore;
    const canvas = world.renderer?.three.domElement;
    if (!canvas) return;

    const init = async () => {
      // 1. Raycasters (must come before Highlighter)
      const raycasters = components.get(OBC.Raycasters);
      raycasters.get(world);

      // 2. Highlighter
      const highlighter = components.get(OBF.Highlighter);
      await highlighter.setup({ 
        world,
        // Enable auto-click handling - ThatOpen handles the raycasting
        autoHighlightOnClick: true,
      });

      // Use ctrlKey for additive selection (matches SketchUp Ctrl behavior)
      // We'll handle Shift (toggle) and Alt (subtract) ourselves
      highlighter.multiple = 'ctrlKey';

      highlighterRef.current = highlighter;

      // 3. Listen for Highlighter events to update React state
      highlighter.events.select.onHighlight.add(() => {
        console.log('[useSelection] onHighlight fired by ThatOpen');
        const current = highlighter.selection.select as SelectionMap | undefined;
        console.log('[useSelection] New selection:', current);
        publishSelection(current ?? null);
      });

      highlighter.events.select.onClear.add(() => {
        console.log('[useSelection] onClear fired by ThatOpen');
        publishSelection(null);
      });

      // 4. SelectionManager (input handling + rubber band)
      const fragments = components.get(OBC.FragmentsManager);

      const manager = new SelectionManager({
        dragThreshold,

        onRectangleSelect: async (rect, windowMode, rectModifier) => {
          await applyRectangleSelection(
            fragments,
            highlighter,
            world,
            rect,
            windowMode,
            rectModifier,
          );
        },

        onClickSelect: async (clickModifier: SelectionModifier) => {
          console.log('[useSelection] onClickSelect called with:', clickModifier);
          // Only called for Shift (toggle) and Alt (subtract)
          // Ctrl (add) and plain clicks (replace) are handled by Highlighter automatically
          
          // 1. Snapshot current selection before raycasting
          const current = (highlighter.selection.select as SelectionMap) ?? {};
          console.log('[useSelection] Current selection:', current);
          
          // 2. Raycast to find what's under the cursor (ThatOpen's built-in raycasting)
          await highlighter.highlight('select', true, false); // removePrevious=true to get fresh pick
          const picked = (highlighter.selection.select as SelectionMap) ?? {};
          console.log('[useSelection] Picked after highlight():', picked);
          
          // 3. Apply modifier and commit (same pattern as rectangle selection)
          const merged = applyModifier(current, picked, clickModifier);
          console.log('[useSelection] Merged result:', merged);
          await commitSelection(highlighter, merged);
          console.log('[useSelection] Selection committed');
        },

        onSelectionCleared: () => {
          highlighter.clear('select');
        },

        onDragStateChanged: (isDragging: boolean) => {
          const controls = (world.camera as any).controls;
          if (controls) controls.enabled = !isDragging;
        },
      });

      manager.attach(canvas);
      managerRef.current = manager;
      initRef.current = true;
    };

    init();

    return () => {
      managerRef.current?.detach();
      managerRef.current = null;
      if (highlighterRef.current) {
        highlighterRef.current.dispose();
        highlighterRef.current = null;
      }
      initRef.current = false;
    };
  }, [viewerCore, dragThreshold, publishSelection]);

  return {
    highlighter: highlighterRef.current,
    selection,
    selectionInfo,
  };
}
