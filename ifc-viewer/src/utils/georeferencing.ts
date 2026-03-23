import * as THREE from 'three';
import type { MapConversion } from '../config/scene';

/**
 * Load map conversion metadata from a URL
 */
export async function loadMapConversionFromUrl(url: string): Promise<MapConversion | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Map conversion metadata not found: ${url}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load map conversion from ${url}:`, error);
    return null;
  }
}

/**
 * Load map conversion metadata for a fragment file (legacy path)
 */
export async function loadMapConversion(fragmentFileName: string): Promise<MapConversion | null> {
  const BASE_URL = import.meta.env.BASE_URL;
  const baseUrl = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const METADATA_BASE_PATH = `${baseUrl}models/model-properties`;

  const metadataFileName = fragmentFileName.replace(/\.frag$/i, '-mapconversion.json');
  const metadataUrl = `${METADATA_BASE_PATH}/${metadataFileName}`;

  return loadMapConversionFromUrl(metadataUrl);
}

/**
 * Calculate transformation matrix to position a model relative to scene origin
 */
export function calculateTransformationMatrix(
  modelMapConversion: MapConversion,
  sceneOrigin: { eastings: number; northings: number; height: number }
): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();

  // Calculate offset from scene origin to model origin
  const offsetX = modelMapConversion.eastings - sceneOrigin.eastings;
  const offsetY = modelMapConversion.orthogonalHeight - sceneOrigin.height;
  const offsetZ = -(modelMapConversion.northings - sceneOrigin.northings); // Negative Z for north

  // Apply translation
  matrix.makeTranslation(offsetX, offsetY, offsetZ);

  // Apply rotation if present (for models not aligned with north)
  if (
    modelMapConversion.xAxisAbscissa !== null &&
    modelMapConversion.xAxisAbscissa !== undefined &&
    modelMapConversion.xAxisOrdinate !== null &&
    modelMapConversion.xAxisOrdinate !== undefined
  ) {
    const angle = Math.atan2(modelMapConversion.xAxisOrdinate, modelMapConversion.xAxisAbscissa);
    const rotationMatrix = new THREE.Matrix4().makeRotationY(angle);
    matrix.multiply(rotationMatrix);
  }

  // Apply scale if present and not 1
  if (modelMapConversion.scale !== null && modelMapConversion.scale !== undefined && modelMapConversion.scale !== 1) {
    const scaleValue = modelMapConversion.scale;
    const scaleMatrix = new THREE.Matrix4().makeScale(
      scaleValue,
      scaleValue,
      scaleValue
    );
    matrix.multiply(scaleMatrix);
  }

  return matrix;
}

/**
 * Apply georeferencing transformation to a Three.js object
 */
export function applyGeoTransform(
  object: THREE.Object3D,
  modelMapConversion: MapConversion,
  sceneOrigin: { eastings: number; northings: number; height: number }
): void {
  const matrix = calculateTransformationMatrix(modelMapConversion, sceneOrigin);
  object.applyMatrix4(matrix);
}
