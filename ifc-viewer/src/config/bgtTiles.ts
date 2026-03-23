/**
 * BGT Vector Tiles Configuration
 *
 * PDOK BGT OGC API Tiles service for the Basisregistratie Grootschalige Topografie.
 * Uses OGC API Tiles with vector tiles (MVT) in EPSG:28992 (Dutch RD New).
 */

import { SCENE_ORIGIN_EPSG28992 } from './scene';

/**
 * Scene origin in RD (EPSG:28992) - imported from scene config
 * Used to convert between Three.js local coordinates and RD coordinates
 */
export function getSceneOriginRD() {
  if (SCENE_ORIGIN_EPSG28992) {
    return {
      x: SCENE_ORIGIN_EPSG28992.eastings,
      y: SCENE_ORIGIN_EPSG28992.northings,
    };
  }
  // Fallback to Amsterdam Centraal if no scene origin configured
  return {
    x: 121500,
    y: 487500,
  };
}

// Default extent around scene origin (±500m)
export function getDefaultExtentRD() {
  const origin = getSceneOriginRD();
  return {
    minX: origin.x - 500,
    minY: origin.y - 500,
    maxX: origin.x + 500,
    maxY: origin.y + 500,
  };
}

/**
 * EPSG:28992 (RD New) projection definition for proj4
 * Source: https://epsg.io/28992
 */
export const EPSG_28992_PROJ4 =
  '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';

// PDOK BGT OGC API Tiles endpoint
export const BGT_OGC_API_URL = 'https://api.pdok.nl/lv/bgt/ogc/v1';

// EPSG:28992 tile matrix origin (top-left corner)
// From PDOK BGT OGC API tile matrix set
export const TILE_MATRIX_ORIGIN = [-285401.92, 903401.92] as const;

// Resolution (meters per pixel) for each zoom level in EPSG:28992
// From PDOK BGT tile matrix set specification
export const RESOLUTIONS = [
  3440.64, // 0
  1720.32, // 1
  860.16, // 2
  430.08, // 3
  215.04, // 4
  107.52, // 5
  53.76, // 6
  26.88, // 7
  13.44, // 8
  6.72, // 9
  3.36, // 10
  1.68, // 11
  0.84, // 12
  0.42, // 13
  0.21, // 14
  0.105, // 15
] as const;

// Debounce delay (ms) for camera-driven tile updates
export const CAMERA_DEBOUNCE_MS = 300;

// Only zoom level 12 has tile data on PDOK BGT
export const BGT_ZOOM_LEVEL = 12;

// Tile size in pixels (MVT tiles use 4096 extent internally)
export const MVT_TILE_SIZE = 256;
export const MVT_EXTENT = 4096;

// Tile ground size at zoom 12: 256 * 0.84 = 215.04 meters per tile
export const TILE_GROUND_SIZE = MVT_TILE_SIZE * RESOLUTIONS[BGT_ZOOM_LEVEL]; // 215.04m
