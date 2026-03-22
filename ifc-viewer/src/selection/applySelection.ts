/**
 * Selection application logic — bridges SelectionManager with ThatOpen
 * fragments and Highlighter.
 */

import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import type { SelectionRect, SelectionModifier } from './SelectionManager';

type SelectionMap = Record<string, Set<number>>;

// ---------------------------------------------------------------------------
// Selection set arithmetic
// ---------------------------------------------------------------------------

function cloneSelection(sel: SelectionMap): SelectionMap {
  const out: SelectionMap = {};
  for (const [k, v] of Object.entries(sel)) out[k] = new Set(v);
  return out;
}

function addSelections(base: SelectionMap, incoming: SelectionMap): SelectionMap {
  const out = cloneSelection(base);
  for (const [id, ids] of Object.entries(incoming)) {
    if (!out[id]) out[id] = new Set();
    for (const v of ids) out[id].add(v);
  }
  return out;
}

function subtractSelections(base: SelectionMap, incoming: SelectionMap): SelectionMap {
  const out = cloneSelection(base);
  for (const [id, ids] of Object.entries(incoming)) {
    if (!out[id]) continue;
    for (const v of ids) out[id].delete(v);
    if (out[id].size === 0) delete out[id];
  }
  return out;
}

function toggleSelections(base: SelectionMap, incoming: SelectionMap): SelectionMap {
  const out = cloneSelection(base);
  for (const [id, ids] of Object.entries(incoming)) {
    if (!out[id]) out[id] = new Set();
    for (const v of ids) {
      if (out[id].has(v)) out[id].delete(v);
      else out[id].add(v);
    }
    if (out[id].size === 0) delete out[id];
  }
  return out;
}

export function applyModifier(current: SelectionMap, incoming: SelectionMap, modifier: SelectionModifier): SelectionMap {
  switch (modifier) {
    case 'add':      return addSelections(current, incoming);
    case 'subtract': return subtractSelections(current, incoming);
    case 'toggle':   return toggleSelections(current, incoming);
    case 'replace':
    default:         return incoming;
  }
}

/**
 * Commits the final selection to the highlighter.
 * Used by both rectangle and single-click selection.
 */
export async function commitSelection(highlighter: OBF.Highlighter, sel: SelectionMap): Promise<void> {
  if (Object.keys(sel).length > 0) {
    await highlighter.highlightByID('select', sel, true);
  } else {
    await highlighter.clear('select');
  }
}

// ---------------------------------------------------------------------------
// Rectangle selection
// ---------------------------------------------------------------------------

export async function applyRectangleSelection(
  fragments: OBC.FragmentsManager,
  highlighter: OBF.Highlighter,
  world: OBC.World,
  rect: SelectionRect,
  windowMode: boolean,
  modifier: SelectionModifier,
): Promise<void> {
  const renderer = world.renderer?.three;
  if (!renderer) return;

  const camera = world.camera.three as unknown as THREE.PerspectiveCamera;
  const dom = renderer.domElement;
  const minX = Math.min(rect.x1, rect.x2);
  const maxX = Math.max(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxY = Math.max(rect.y1, rect.y2);

  const incoming: SelectionMap = {};
  for (const [modelId, model] of fragments.list) {
    try {
      const result = await model.rectangleRaycast({
        camera, dom,
        topLeft: new THREE.Vector2(minX, minY),
        bottomRight: new THREE.Vector2(maxX, maxY),
        fullyIncluded: windowMode,
      });
      if (result && result.localIds.length > 0) {
        incoming[modelId] = new Set(result.localIds);
      }
    } catch (err) {
      console.warn(`[Selection] rectangleRaycast failed for ${modelId}:`, err);
    }
  }

  const current = (highlighter.selection.select as SelectionMap) ?? {};
  await commitSelection(highlighter, applyModifier(current, incoming, modifier));
}

// ---------------------------------------------------------------------------
// NOTE: Single-click selection is handled directly in useSelection.ts hook
// using ThatOpen's built-in highlight() method for raycasting.
// This is more reliable than manual Three.js raycasting.
// ---------------------------------------------------------------------------
