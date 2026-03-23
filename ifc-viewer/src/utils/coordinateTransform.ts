/**
 * Coordinate transformation utilities
 * Converts between RD (EPSG:28992) and Three.js scene coordinates
 */

import proj4 from 'proj4';
import { getSceneOriginRD, EPSG_28992_PROJ4 } from '../config/bgtTiles';
import * as THREE from 'three';

// Register EPSG:28992 projection
proj4.defs('EPSG:28992', EPSG_28992_PROJ4);

/**
 * Scene coordinate system:
 * - Origin: Dynamic scene origin from config (defaults to model coordinates)
 * - 1 Three.js unit = 1 meter
 * - X axis: East-West (RD X)
 * - Y axis: Up (elevation)
 * - Z axis: North-South (RD Y, but inverted for right-handed system)
 */

/**
 * Convert RD coordinates to Three.js scene coordinates
 * @param rdX RD X coordinate (Easting)
 * @param rdY RD Y coordinate (Northing)
 * @param elevation Optional elevation in meters (default: 0)
 * @returns Three.js Vector3 in scene coordinates
 */
export function rdToScene(
  rdX: number,
  rdY: number,
  elevation: number = 0
): THREE.Vector3 {
  // Offset from scene origin
  const sceneOrigin = getSceneOriginRD();
  const x = rdX - sceneOrigin.x;
  const z = -(rdY - sceneOrigin.y); // Inverted for right-handed system
  const y = elevation;

  return new THREE.Vector3(x, y, z);
}

/**
 * Convert Three.js scene coordinates to RD coordinates
 * @param sceneX Scene X coordinate
 * @param sceneZ Scene Z coordinate
 * @returns Object with rdX and rdY coordinates
 */
export function sceneToRD(
  sceneX: number,
  sceneZ: number
): { rdX: number; rdY: number } {
  const sceneOrigin = getSceneOriginRD();
  const rdX = sceneX + sceneOrigin.x;
  const rdY = -sceneZ + sceneOrigin.y; // Inverted back

  return { rdX, rdY };
}

/**
 * Convert WGS84 lat/lon to RD coordinates
 * @param latitude WGS84 latitude
 * @param longitude WGS84 longitude
 * @returns Object with rdX and rdY coordinates
 */
export function wgs84ToRD(
  latitude: number,
  longitude: number
): { rdX: number; rdY: number } {
  const [rdX, rdY] = proj4('EPSG:4326', 'EPSG:28992', [longitude, latitude]);
  return { rdX, rdY };
}

/**
 * Convert RD coordinates to WGS84 lat/lon
 * @param rdX RD X coordinate (Easting)
 * @param rdY RD Y coordinate (Northing)
 * @returns Object with latitude and longitude
 */
export function rdToWGS84(
  rdX: number,
  rdY: number
): { latitude: number; longitude: number } {
  const [longitude, latitude] = proj4('EPSG:28992', 'EPSG:4326', [rdX, rdY]);
  return { latitude, longitude };
}

/**
 * Convert WGS84 lat/lon to Three.js scene coordinates
 * @param latitude WGS84 latitude
 * @param longitude WGS84 longitude
 * @param elevation Optional elevation in meters (default: 0)
 * @returns Three.js Vector3 in scene coordinates
 */
export function wgs84ToScene(
  latitude: number,
  longitude: number,
  elevation: number = 0
): THREE.Vector3 {
  const { rdX, rdY } = wgs84ToRD(latitude, longitude);
  return rdToScene(rdX, rdY, elevation);
}
