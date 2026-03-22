import { useEffect, useRef } from 'react';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import type { ViewerCore } from '../types/viewer.types';
import { SelectionManager, applyRectangleSelection } from '../selection';
import type { SelectionModifier } from '../selection';

export interface UseRectangularSelectionOptions {
  /** Minimum drag distance (pixels) before starting rectangular selection @default 5 */
  dragThreshold?: number;
}

/**
 * Thin React wrapper around SelectionManager.
 *
 * Creates a SelectionManager instance, wires its callbacks to the
 * ThatOpen FragmentsManager / Highlighter, and attaches / detaches
 * on the canvas lifecycle.
 *
 * Single-click modifier handling is done via `pendingClickModifier` ref
 * which is consumed by useHighlighter's onHighlight listener.
 */
export function useRectangularSelection(
  viewerCore: ViewerCore | null,
  highlighter: OBF.Highlighter | null,
  pendingClickModifierRef: React.MutableRefObject<SelectionModifier | null>,
  options: UseRectangularSelectionOptions = {},
) {
  const { dragThreshold = 5 } = options;
  const managerRef = useRef<SelectionManager | null>(null);

  useEffect(() => {
    if (!viewerCore || !highlighter) return;

    const canvas = viewerCore.world.renderer?.three.domElement;
    if (!canvas) return;

    const fragments = viewerCore.components.get(OBC.FragmentsManager);

    const manager = new SelectionManager({
      dragThreshold,

      onRectangleSelect: async (rect, windowMode, modifier) => {
        await applyRectangleSelection(
          fragments,
          highlighter,
          viewerCore.world,
          rect,
          windowMode,
          modifier,
        );
      },

      onClickSelect: (modifier: SelectionModifier) => {
        // Store the modifier so useHighlighter can pick it up in onHighlight
        pendingClickModifierRef.current = modifier;
      },

      onSelectionCleared: () => {
        highlighter.clear('select');
      },

      onDragStateChanged: (isDragging: boolean) => {
        const controls = (viewerCore.world.camera as any).controls;
        if (controls) controls.enabled = !isDragging;
      },
    });

    manager.attach(canvas);
    managerRef.current = manager;

    return () => {
      manager.detach();
      managerRef.current = null;
    };
  }, [viewerCore, highlighter, dragThreshold, pendingClickModifierRef]);
}
