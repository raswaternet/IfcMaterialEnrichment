/**
 * MVTTileService
 *
 * Fetches MVT (Mapbox Vector Tile) tiles from PDOK BGT OGC API,
 * parses them, and converts vector features to Three.js geometry.
 * No rasterization — polygons become meshes, lines become lines.
 */

import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import * as THREE from 'three';

import {
  getSceneOriginRD,
  BGT_OGC_API_URL,
  TILE_MATRIX_ORIGIN,

  BGT_ZOOM_LEVEL,
  MVT_EXTENT,
  TILE_GROUND_SIZE,
} from '../config/bgtTiles';
import { getFeatureColor } from '../config/bgtStyle3D';

// LRU cache: keeps tile geometry in memory, evicts oldest when over limit.
// Evicted tiles get their Three.js geometry disposed.
const MAX_CACHED_TILES = 150;

class TileLRUCache {
  private cache = new Map<string, THREE.Group>();

  get(key: string): THREE.Group | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: THREE.Group): void {
    // If already present, delete first to refresh insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    this.evict();
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): THREE.Group | undefined {
    const value = this.cache.get(key);
    this.cache.delete(key);
    return value;
  }

  /** Evict oldest entries beyond MAX_CACHED_TILES, disposing their geometry. */
  private evict(): void {
    while (this.cache.size > MAX_CACHED_TILES) {
      const oldestKey = this.cache.keys().next().value!;
      const oldestGroup = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);

      // Remove from scene if still attached
      oldestGroup.removeFromParent();

      // Dispose geometry
      oldestGroup.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
        }
      });

    }
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    for (const [, group] of this.cache) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
        }
      });
    }
    this.cache.clear();
  }
}

const tileCache = new TileLRUCache();
const loadingTiles = new Set<string>();

/**
 * Calculate tile row/col for a given RD coordinate at zoom 12.
 */
export function rdToTileCoord(rdX: number, rdY: number): { row: number; col: number } {
  const tileWidthMeters = TILE_GROUND_SIZE;
  const col = Math.floor((rdX - TILE_MATRIX_ORIGIN[0]) / tileWidthMeters);
  // Y-axis: origin is at top (maxY), tiles go downward
  const row = Math.floor((TILE_MATRIX_ORIGIN[1] - rdY) / tileWidthMeters);
  return { row, col };
}

/**
 * Calculate the RD origin (top-left corner) of a tile.
 */
function tileToRD(row: number, col: number): { rdX: number; rdY: number } {
  const rdX = TILE_MATRIX_ORIGIN[0] + col * TILE_GROUND_SIZE;
  const rdY = TILE_MATRIX_ORIGIN[1] - row * TILE_GROUND_SIZE;
  return { rdX, rdY };
}

/**
 * Convert tile-local coordinates (0..4096) to scene coordinates.
 * Tile origin is top-left. Scene: X=East, Z=-North (inverted Y).
 */
function tileLocalToScene(
  tileX: number,
  tileY: number,
  tileOriginRdX: number,
  tileOriginRdY: number,
): { x: number; z: number } {
  // Scale from MVT extent (0..4096) to meters
  const metersPerUnit = TILE_GROUND_SIZE / MVT_EXTENT;
  const rdX = tileOriginRdX + tileX * metersPerUnit;
  const rdY = tileOriginRdY - tileY * metersPerUnit; // Y flipped in tiles

  // Convert RD to scene coordinates (offset from scene origin)
  const sceneOrigin = getSceneOriginRD();
  const x = rdX - sceneOrigin.x;
  const z = -(rdY - sceneOrigin.y); // Invert for right-handed system
  return { x, z };
}

/**
 * Fetch and parse a single MVT tile.
 */
async function fetchTile(row: number, col: number): Promise<VectorTile> {
  const url = `${BGT_OGC_API_URL}/tiles/NetherlandsRDNewQuad/${BGT_ZOOM_LEVEL}/${row}/${col}?f=mvt`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Tile ${row}/${col} failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new VectorTile(new Pbf(buffer));
}

/**
 * Build Three.js geometry from a parsed MVT feature (polygon).
 */
function buildPolygonMesh(
  rings: Array<Array<{ x: number; z: number }>>,
  color: string,
  yOffset: number = 0,
): THREE.Mesh | null {
  if (rings.length === 0 || rings[0].length < 3) return null;

  const outerRing = rings[0];

  // Build a THREE.Shape from the outer ring
  const shape = new THREE.Shape();
  shape.moveTo(outerRing[0].x, outerRing[0].z);
  for (let i = 1; i < outerRing.length; i++) {
    shape.lineTo(outerRing[i].x, outerRing[i].z);
  }
  shape.closePath();

  // Add holes from inner rings
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h];
    if (hole.length < 3) continue;
    const holePath = new THREE.Path();
    holePath.moveTo(hole[0].x, hole[0].z);
    for (let i = 1; i < hole.length; i++) {
      holePath.lineTo(hole[i].x, hole[i].z);
    }
    holePath.closePath();
    shape.holes.push(holePath);
  }

  // Create flat geometry using ShapeGeometry
  // This uses THREE's built-in Earcut triangulation
  try {
    const geometry = new THREE.ShapeGeometry(shape, 1);

    // ShapeGeometry creates geometry in XY plane.
    // We need it in XZ plane (horizontal ground).
    // Rotate the geometry directly: swap Y→Z, set Y to yOffset
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i); // this is our Z
      positions.setXYZ(i, x, yOffset, y);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const material = getMaterial(color);
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  } catch {
    // Triangulation can fail on degenerate polygons
    return null;
  }
}

/**
 * Build Three.js line from a parsed MVT feature (linestring).
 */
function buildLine(
  points: Array<{ x: number; z: number }>,
  color: string,
  yOffset: number = 0.05,
): THREE.Line | null {
  if (points.length < 2) return null;

  const vertices: number[] = [];
  for (const p of points) {
    vertices.push(p.x, yOffset, p.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  const material = getLineMaterial(color);
  return new THREE.Line(geometry, material);
}

// Material cache to avoid creating duplicate materials
const materialCache = new Map<string, THREE.MeshBasicMaterial>();
const lineMaterialCache = new Map<string, THREE.LineBasicMaterial>();

function getMaterial(color: string): THREE.MeshBasicMaterial {
  let mat = materialCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    materialCache.set(color, mat);
  }
  return mat;
}

function getLineMaterial(color: string): THREE.LineBasicMaterial {
  let mat = lineMaterialCache.get(color);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({ color });
    lineMaterialCache.set(color, mat);
  }
  return mat;
}

/**
 * Process all features in a tile and return a Three.js Group.
 */
function buildTileGroup(tile: VectorTile, row: number, col: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `BGT-Tile-${row}-${col}`;

  const { rdX: tileOriginRdX, rdY: tileOriginRdY } = tileToRD(row, col);

  // Layer render order: terrain first, then water, roads, buildings on top
  const layerOrder = [
    'begroeidterreindeel',
    'onbegroeidterreindeel',
    'ondersteunendwaterdeel',
    'waterdeel',
    'ondersteunendwegdeel',
    'wegdeel',
    'overbruggingsdeel',
    'tunneldeel',
    'spoor',
    'scheiding_vlak',
    'kunstwerkdeel_vlak',
    'gebouwinstallatie',
    'overigbouwwerk',
    'pand',
  ];

  // Y offsets to prevent z-fighting between layers
  const layerY: Record<string, number> = {};
  layerOrder.forEach((name, i) => {
    layerY[name] = -0.1 + i * 0.01; // -0.1 to -0.1 + 0.13
  });

  for (const layerName of layerOrder) {
    const layer = tile.layers[layerName];
    if (!layer) continue;

    for (let f = 0; f < layer.length; f++) {
      const feature = layer.feature(f);
      const geomType = feature.type;
      const properties = feature.properties;
      const color = getFeatureColor(layerName, properties);
      const yOffset = layerY[layerName] ?? -0.05;

      if (geomType === 3) {
        // Polygon
        const geometry = feature.loadGeometry();
        const rings: Array<Array<{ x: number; z: number }>> = [];

        for (const ring of geometry) {
          const sceneRing: Array<{ x: number; z: number }> = [];
          for (const point of ring) {
            sceneRing.push(tileLocalToScene(point.x, point.y, tileOriginRdX, tileOriginRdY));
          }
          rings.push(sceneRing);
        }

        const mesh = buildPolygonMesh(rings, color, yOffset);
        if (mesh) {
          mesh.userData.layer = layerName;
          group.add(mesh);
        }
      } else if (geomType === 2) {
        // LineString
        const geometry = feature.loadGeometry();
        for (const line of geometry) {
          const points = line.map((p) =>
            tileLocalToScene(p.x, p.y, tileOriginRdX, tileOriginRdY)
          );
          const lineObj = buildLine(points, color, yOffset + 0.01);
          if (lineObj) {
            lineObj.userData.layer = layerName;
            group.add(lineObj);
          }
        }
      }
      // Skip point features (type 1) — not needed for ground plane
    }
  }

  return group;
}

/**
 * Load a tile and return its Three.js group.
 * Uses caching to avoid re-fetching.
 */
export async function loadTile(row: number, col: number): Promise<THREE.Group | null> {
  const key = `${row}_${col}`;

  // Return cached tile
  if (tileCache.has(key)) {
    return tileCache.get(key)!;
  }

  // Skip if already loading
  if (loadingTiles.has(key)) {
    return null;
  }

  loadingTiles.add(key);

  try {
    const tile = await fetchTile(row, col);
    const group = buildTileGroup(tile, row, col);
    tileCache.set(key, group);
    return group;
  } catch (err) {
    return null;
  } finally {
    loadingTiles.delete(key);
  }
}

/**
 * Get all tile coordinates needed to cover an RD extent.
 */
export function getTilesForExtent(extent: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): Array<{ row: number; col: number }> {
  const topLeft = rdToTileCoord(extent.minX, extent.maxY);
  const bottomRight = rdToTileCoord(extent.maxX, extent.minY);

  const tiles: Array<{ row: number; col: number }> = [];
  for (let row = topLeft.row; row <= bottomRight.row; row++) {
    for (let col = topLeft.col; col <= bottomRight.col; col++) {
      tiles.push({ row, col });
    }
  }
  return tiles;
}

/**
 * Detach a tile from the scene but keep it in the LRU cache.
 * Returns the group so the caller can remove it from the scene,
 * or null if the tile wasn't in cache.
 */
export function detachTile(row: number, col: number): THREE.Group | null {
  const key = `${row}_${col}`;
  const group = tileCache.get(key);
  if (group) {
    group.removeFromParent();
    return group;
  }
  return null;
}

/**
 * Force-remove a tile from cache AND dispose its geometry.
 * Used during cleanup/unmount.
 */
export function removeTile(row: number, col: number): THREE.Group | null {
  const key = `${row}_${col}`;
  const group = tileCache.delete(key);
  return group ?? null;
}

/**
 * Dispose all geometry in a tile group.
 */
export function disposeTileGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
    }
  });
}

/**
 * Clear the entire tile cache and dispose all geometry.
 */
export function clearTileCache(): void {
  tileCache.clear();
}
