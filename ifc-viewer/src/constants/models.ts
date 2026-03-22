/**
 * Known IFC model files available in /public/models/
 */
export const KNOWN_IFC_FILES = [
  '3D-omgeving.nl-3DBAG.ifc',
  '3D-omgeving.nl-BAG-Pand.ifc',
  '3D-omgeving.nl-BGT.ifc',
  '3D-omgeving.nl-BRK-Perceel.ifc',
  '3D-omgeving.nl-DSO-Enkelbestemming.ifc',
  '3D-omgeving.nl-DSO-Maatvoering.ifc',
  '3D-omgeving.nl-GEO-Nulpunt.ifc',
] as const;

/**
 * Pre-converted fragment files for fast loading
 */
export const KNOWN_FRAGMENT_FILES = [
  'ZB1234_600_BIM_MOD_001_RG Jan de Jonghstraat_detached.frag',
] as const;

export const MODELS_BASE_PATH = '/models';
export const FRAGMENTS_BASE_PATH = '/models/model-geometry/fragments';
