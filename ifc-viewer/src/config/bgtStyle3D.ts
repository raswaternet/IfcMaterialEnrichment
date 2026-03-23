/**
 * BGT Vector Tile 3D Styling
 *
 * Color mapping for BGT features rendered as Three.js geometry.
 * Colors based on the official PDOK BGT achtergrondvisualisatie.
 */

export const BGT_COLORS = {
  water: '#9BCBE9',
  waterEdge: '#e1eddb',
  grassLow: '#e1eddb',
  grassHigh: '#c3dbb6',
  sand: '#fdf6bb',
  heather: '#e3dce7',
  builtUp: '#fefefe',
  private: '#F9F9E7',
  road: '#ffffff',
  roadCasing: '#d1c1be',
  cyclePath: '#fdeff8',
  building: '#d3d3d3',
  structure: '#e3dce7',
  rail: '#b4b4b4',
  tram: '#999999',
  background: '#fefefe',
} as const;

/**
 * Get the color for a BGT feature based on its layer and properties.
 */
export function getFeatureColor(
  layerName: string,
  properties: Record<string, unknown>,
): string {
  const fysiek = (properties['bgt-fysiekvoorkomen'] ?? properties['fysiekvoorkomen'] ?? '') as string;
  const functie = (properties['bgt-functie'] ?? properties['functie'] ?? '') as string;

  switch (layerName) {
    case 'waterdeel':
      return BGT_COLORS.water;
    case 'ondersteunendwaterdeel':
      return BGT_COLORS.waterEdge;

    case 'begroeidterreindeel':
      if (fysiek === 'loofbos' || fysiek === 'naaldbos' || fysiek === 'gemengd bos')
        return BGT_COLORS.grassHigh;
      if (fysiek === 'heide') return BGT_COLORS.heather;
      return BGT_COLORS.grassLow;

    case 'onbegroeidterreindeel':
      if (fysiek === 'zand') return BGT_COLORS.sand;
      if (fysiek === 'erf') return BGT_COLORS.private;
      return BGT_COLORS.builtUp;

    case 'wegdeel':
      if (functie === 'fietspad' || functie === 'voetpad' || functie === 'voetpad op trap' || functie === 'voetgangersgebied')
        return BGT_COLORS.cyclePath;
      return BGT_COLORS.road;

    case 'ondersteunendwegdeel':
      if (functie === 'groenvoorziening') return BGT_COLORS.grassLow;
      return BGT_COLORS.builtUp;

    case 'spoor':
      if (functie === 'tram' || functie === 'sneltram') return BGT_COLORS.tram;
      return BGT_COLORS.rail;

    case 'pand':
      return BGT_COLORS.building;

    case 'gebouwinstallatie':
    case 'overigbouwwerk':
    case 'kunstwerkdeel_vlak':
    case 'scheiding_vlak':
      return BGT_COLORS.structure;

    case 'overbruggingsdeel':
    case 'tunneldeel':
      return BGT_COLORS.road;

    default:
      return BGT_COLORS.background;
  }
}
