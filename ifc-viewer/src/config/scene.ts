/**
 * Scene configuration for EPSG:28992 coordinate system
 */

export interface MapConversion {
  eastings: number;
  northings: number;
  orthogonalHeight: number;
  xAxisAbscissa?: number | null;
  xAxisOrdinate?: number | null;
  scale?: number | null;
  crsName?: string | null;
  description?: string | null;
}

export interface ModelDefinition {
  /** Model file name (without path) */
  fileName: string;
  /** Display name */
  name: string;
  /** Map conversion metadata */
  mapConversion?: MapConversion;
}

/**
 * Scene origin in EPSG:28992 (RD New)
 * All models will be positioned relative to this point
 * Set to null to use the first loaded model as origin
 */
export const SCENE_ORIGIN_EPSG28992: { eastings: number; northings: number; height: number } | null = {
  eastings: 116650,
  northings: 488080,
  height: 0,
};

/**
 * Available models with their georeferencing data
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    fileName: 'ZB1234_600_BIM_MOD_001_RG Jan de Jonghstraat_detached.frag',
    name: 'Jan de Jonghstraat',
    // mapConversion will be loaded from JSON metadata
  },
  {
    fileName: '23434-DO-Civiel_v2.0_20250428.frag',
    name: 'DO Civiel',
  },
  {
    fileName: '23434-DO-Staal_gesloten stand_v2.0_20250428.frag',
    name: 'DO Staal',
  },
  {
    fileName: 'BT-test.frag',
    name: 'BT Test',
  },
  {
    fileName: 'Roads.frag',
    name: 'Roads',
  },
];
