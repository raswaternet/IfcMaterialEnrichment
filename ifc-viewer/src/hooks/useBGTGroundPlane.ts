/**
 * useBGTGroundPlane Hook
 *
 * Renders BGT vector tiles as native Three.js geometry.
 * MVT tiles are parsed and converted to meshes/lines — no rasterization.
 * Tiles are dynamically loaded/unloaded based on camera position.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import type * as OBC from '@thatopen/components';

import {
  loadTile,
  getTilesForExtent,
  detachTile,
  clearTileCache,
} from '../services/MVTTileService';
import { getSceneOriginRD, getDefaultExtentRD, CAMERA_DEBOUNCE_MS } from '../config/bgtTiles';

export interface BGTGroundPlaneState {
  mesh: THREE.Group | null;
  loading: boolean;
  error: string | null;
  progress: number;
  opacity: number;
  visible: boolean;
}

export interface UseBGTGroundPlaneReturn extends BGTGroundPlaneState {
  setOpacity: (opacity: number) => void;
  setVisible: (visible: boolean) => void;
  reload: () => Promise<void>;
  zoomToExtent: () => void;
}

/**
 * Compute the visible ground extent from the Three.js camera frustum.
 *
 * Rays that hit the ground plane beyond MAX_RAY_DISTANCE from the camera
 * are clamped — this prevents near-horizon rays from producing an
 * enormous extent while still loading every tile that is actually useful.
 */
const MAX_RAY_DISTANCE = 5000; // meters from camera

function computeVisibleRDExtent(
  camera: THREE.Camera,
  padding: number = 0.2,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  const camPos = camera.position;

  // Sample frustum edges + center of each edge
  const ndcPoints = [
    new THREE.Vector2(-1, -1),
    new THREE.Vector2(1, -1),
    new THREE.Vector2(-1, 1),
    new THREE.Vector2(1, 1),
    new THREE.Vector2(0, -1),
    new THREE.Vector2(0, 1),
    new THREE.Vector2(-1, 0),
    new THREE.Vector2(1, 0),
    new THREE.Vector2(0, 0),
  ];

  const hitPoints: THREE.Vector3[] = [];
  for (const ndc of ndcPoints) {
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, target.clone());
    if (!hit) continue;

    // Clamp hits that are too far from the camera
    const dist = hit.distanceTo(camPos);
    if (dist > MAX_RAY_DISTANCE) {
      // Project to max distance along the ray direction on the ground
      const dir = hit.clone().sub(camPos).normalize();
      hit.copy(camPos).addScaledVector(dir, MAX_RAY_DISTANCE);
      hit.y = 0;
    }
    hitPoints.push(hit);
  }

  if (hitPoints.length < 3) return null;

  let sceneMinX = Infinity, sceneMaxX = -Infinity;
  let sceneMinZ = Infinity, sceneMaxZ = -Infinity;
  for (const p of hitPoints) {
    sceneMinX = Math.min(sceneMinX, p.x);
    sceneMaxX = Math.max(sceneMaxX, p.x);
    sceneMinZ = Math.min(sceneMinZ, p.z);
    sceneMaxZ = Math.max(sceneMaxZ, p.z);
  }

  // Add padding
  const wPad = (sceneMaxX - sceneMinX) * padding;
  const hPad = (sceneMaxZ - sceneMinZ) * padding;
  sceneMinX -= wPad;
  sceneMaxX += wPad;
  sceneMinZ -= hPad;
  sceneMaxZ += hPad;

  // Convert scene → RD using dynamic scene origin
  const sceneOrigin = getSceneOriginRD();
  return {
    minX: sceneMinX + sceneOrigin.x,
    maxX: sceneMaxX + sceneOrigin.x,
    minY: -sceneMaxZ + sceneOrigin.y,
    maxY: -sceneMinZ + sceneOrigin.y,
  };
}

export function useBGTGroundPlane(
  world: OBC.World | null,
  enabled: boolean = true,
): UseBGTGroundPlaneReturn {
  const [rootGroup, setRootGroup] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacityState] = useState(0.8);
  const [visible, setVisibleState] = useState(true);

  const rootGroupRef = useRef<THREE.Group | null>(null);
  const activeTileKeysRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Load tiles for a given RD extent.
   */
  const loadTilesForExtent = useCallback(async (
    extent: { minX: number; minY: number; maxX: number; maxY: number },
  ) => {
    const group = rootGroupRef.current;
    if (!group || !world) return;

    const neededTiles = getTilesForExtent(extent);
    const neededKeys = new Set(neededTiles.map(t => `${t.row}_${t.col}`));

    // Determine which tiles to load (don't detach old ones yet)
    const newTiles = neededTiles.filter(t => !activeTileKeysRef.current.has(`${t.row}_${t.col}`));

    // Load new tiles first (max 6 concurrent), keeping old tiles visible
    const batchSize = 6;
    for (let i = 0; i < newTiles.length; i += batchSize) {
      const batch = newTiles.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(({ row, col }) => loadTile(row, col)),
      );

      for (let j = 0; j < batch.length; j++) {
        const tileGroup = results[j];
        if (tileGroup && rootGroupRef.current) {
          rootGroupRef.current.add(tileGroup);
          activeTileKeysRef.current.add(`${batch[j].row}_${batch[j].col}`);
        }
      }

      setProgress(Math.round(((i + batch.length) / newTiles.length) * 100));
    }

    // Only now detach tiles that are no longer needed (kept in LRU cache)
    for (const key of activeTileKeysRef.current) {
      if (!neededKeys.has(key)) {
        const [row, col] = key.split('_').map(Number);
        detachTile(row, col);
        activeTileKeysRef.current.delete(key);
      }
    }
  }, [world]);

  /**
   * Initialize: create root group, load initial tiles.
   */
  const initialize = useCallback(async () => {
    if (!world || !enabled) return;

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      const group = new THREE.Group();
      group.name = 'BGT-Ground-Plane';

      const scene = world.scene.three;
      scene.add(group);
      rootGroupRef.current = group;

      // Load tiles based on what the camera actually sees (fallback to default extent)
      const rdExtent = computeVisibleRDExtent(world.camera.three);
      await loadTilesForExtent(rdExtent ?? getDefaultExtentRD());

      setRootGroup(group);
      setLoading(false);
      setProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setLoading(false);
    }
  }, [world, enabled, loadTilesForExtent]);

  /**
   * Camera-driven tile update.
   */
  const updateTilesFromCamera = useCallback(() => {
    if (!world || !rootGroupRef.current) return;

    const rdExtent = computeVisibleRDExtent(world.camera.three);
    if (!rdExtent) return;

    // Clamp to Netherlands bounds
    rdExtent.minX = Math.max(rdExtent.minX, -7000);
    rdExtent.maxX = Math.min(rdExtent.maxX, 300000);
    rdExtent.minY = Math.max(rdExtent.minY, 289000);
    rdExtent.maxY = Math.min(rdExtent.maxY, 629000);

    loadTilesForExtent(rdExtent);
  }, [world, loadTilesForExtent]);

  // Set up camera tracking
  useEffect(() => {
    if (!world || !enabled) return;

    const camera = world.camera as any;
    const controls = camera?.controls;
    if (!controls) return;

    const onCameraChange = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(updateTilesFromCamera, CAMERA_DEBOUNCE_MS);
    };

    // 'controlend' fires after user interaction, 'rest' after animations settle,
    // 'update' fires on programmatic moves (e.g. setLookAt from orbit-to-model)
    controls.addEventListener('rest', onCameraChange);
    controls.addEventListener('controlend', onCameraChange);
    controls.addEventListener('update', onCameraChange);

    return () => {
      controls.removeEventListener('rest', onCameraChange);
      controls.removeEventListener('controlend', onCameraChange);
      controls.removeEventListener('update', onCameraChange);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [world, enabled, updateTilesFromCamera]);

  // Initialize when world is ready
  useEffect(() => {
    if (world && enabled && !rootGroup && !loading) {
      initialize();
    }

    return () => {
      if (rootGroupRef.current && world) {
        const scene = world.scene.three;
        activeTileKeysRef.current.clear();
        scene.remove(rootGroupRef.current);
        rootGroupRef.current = null;
        setRootGroup(null);
        // Clear entire LRU cache on unmount to free GPU memory
        clearTileCache();
      }
    };
  }, [world, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opacity control
  const setOpacity = useCallback((newOpacity: number) => {
    setOpacityState(newOpacity);
    if (rootGroupRef.current) {
      rootGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.opacity = newOpacity;
          child.material.transparent = newOpacity < 1;
          child.material.needsUpdate = true;
        }
      });
    }
  }, []);

  // Visibility control
  const setVisible = useCallback((newVisible: boolean) => {
    setVisibleState(newVisible);
    if (rootGroupRef.current) {
      rootGroupRef.current.visible = newVisible;
    }
  }, []);

  // Reload
  const reload = useCallback(async () => {
    if (rootGroupRef.current && world) {
      const scene = world.scene.three;
      activeTileKeysRef.current.clear();
      scene.remove(rootGroupRef.current);
      rootGroupRef.current = null;
      setRootGroup(null);
      clearTileCache();
    }
    await initialize();
  }, [world, initialize]);

  // Zoom to extent
  const zoomToExtent = useCallback(() => {
    if (!world) return;
    const camera = world.camera as any;
    if (!camera?.controls?.setLookAt) return;

    const extent = getDefaultExtentRD();
    const width = extent.maxX - extent.minX;
    const height = extent.maxY - extent.minY;
    const dist = Math.max(width, height) * 0.9;
    camera.controls.setLookAt(0, dist * 0.8, dist * 0.6, 0, 0, 0, true);
  }, [world]);

  return {
    mesh: rootGroup,
    loading,
    error,
    progress,
    opacity,
    visible,
    setOpacity,
    setVisible,
    reload,
    zoomToExtent,
  };
}
