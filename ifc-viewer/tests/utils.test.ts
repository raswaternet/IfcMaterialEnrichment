import { describe, it, expect } from 'vitest';

/**
 * Tests for utility functions extracted from main.tsx
 * These tests focus on pure functions that don't require 3D mocking
 */

describe('IFC File Extraction', () => {
  // This function is extracted from main.tsx for testing
  const extractIfcFiles = (html: string): string[] => {
    const ifcFiles: string[] = [];
    const linkRegex = /<a[^>]+href="([^"]+\.ifc)"[^>]*>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      ifcFiles.push(match[1]);
    }
    
    return ifcFiles;
  };

  it('should extract IFC file names from HTML directory listing', () => {
    const html = `
      <html>
        <body>
          <a href="model1.ifc">Model 1</a>
          <a href="model2.ifc">Model 2</a>
          <a href="other.txt">Other file</a>
        </body>
      </html>
    `;

    const result = extractIfcFiles(html);
    expect(result).toEqual(['model1.ifc', 'model2.ifc']);
  });

  it('should handle empty HTML', () => {
    const result = extractIfcFiles('');
    expect(result).toEqual([]);
  });

  it('should handle HTML with no IFC files', () => {
    const html = '<a href="file.txt">Text</a><a href="doc.pdf">PDF</a>';
    const result = extractIfcFiles(html);
    expect(result).toEqual([]);
  });

  it('should extract files with complex paths', () => {
    const html = `
      <a href="/models/subfolder/complex-name.ifc">Complex</a>
      <a href="../relative/path.ifc">Relative</a>
    `;
    const result = extractIfcFiles(html);
    expect(result).toEqual([
      '/models/subfolder/complex-name.ifc',
      '../relative/path.ifc'
    ]);
  });

  it('should handle case-insensitive .ifc extension', () => {
    const html = `
      <a href="model.IFC">Uppercase</a>
      <a href="model.Ifc">Mixed</a>
      <a href="model.ifc">Lowercase</a>
    `;
    const result = extractIfcFiles(html);
    expect(result).toEqual(['model.IFC', 'model.Ifc', 'model.ifc']);
  });

  it('should skip links without href attribute', () => {
    const html = `
      <a>No href</a>
      <a href="valid.ifc">Valid</a>
    `;
    const result = extractIfcFiles(html);
    expect(result).toEqual(['valid.ifc']);
  });

  it('should handle special characters in filenames', () => {
    const html = `
      <a href="model-with-dashes.ifc">Dashes</a>
      <a href="model_with_underscores.ifc">Underscores</a>
      <a href="model with spaces.ifc">Spaces</a>
      <a href="model(123).ifc">Parentheses</a>
    `;
    const result = extractIfcFiles(html);
    expect(result).toHaveLength(4);
  });

  it('should handle Apache directory listing format', () => {
    const html = `
      <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
      <html>
       <head><title>Index of /models</title></head>
       <body>
        <h1>Index of /models</h1>
        <table>
         <tr><td><a href="3D-omgeving.nl-3DBAG.ifc">3D-omgeving.nl-3DBAG.ifc</a></td><td>2024-01-15 10:30</td><td>1.2M</td></tr>
         <tr><td><a href="3D-omgeving.nl-BAG-Pand.ifc">3D-omgeving.nl-BAG-Pand.ifc</a></td><td>2024-01-15 10:31</td><td>850K</td></tr>
        </table>
       </body>
      </html>
    `;
    const result = extractIfcFiles(html);
    expect(result).toEqual([
      '3D-omgeving.nl-3DBAG.ifc',
      '3D-omgeving.nl-BAG-Pand.ifc'
    ]);
  });

  it('should handle Nginx directory listing format', () => {
    const html = `
      <html>
      <head><title>Index of /models/</title></head>
      <body>
      <h1>Index of /models/</h1><hr><pre><a href="../">../</a>
      <a href="model1.ifc">model1.ifc</a>                                        15-Jan-2024 10:30             1048576
      <a href="model2.ifc">model2.ifc</a>                                        15-Jan-2024 10:31              524288
      </pre><hr></body>
      </html>
    `;
    const result = extractIfcFiles(html);
    expect(result).toEqual(['model1.ifc', 'model2.ifc']);
  });
});

describe('Mouse Coordinate Conversion', () => {
  // Helper function extracted for testing
  const convertMouseCoordinates = (
    clientX: number,
    clientY: number,
    rect: { left: number; top: number; width: number; height: number }
  ): { x: number; y: number } => {
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  };

  it('should convert center of canvas to (0, 0)', () => {
    const result = convertMouseCoordinates(
      250, 150,
      { left: 0, top: 0, width: 500, height: 300 }
    );
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('should convert top-left to (-1, 1)', () => {
    const result = convertMouseCoordinates(
      0, 0,
      { left: 0, top: 0, width: 500, height: 300 }
    );
    expect(result.x).toBeCloseTo(-1, 5);
    expect(result.y).toBeCloseTo(1, 5);
  });

  it('should convert bottom-right to (1, -1)', () => {
    const result = convertMouseCoordinates(
      500, 300,
      { left: 0, top: 0, width: 500, height: 300 }
    );
    expect(result.x).toBeCloseTo(1, 5);
    expect(result.y).toBeCloseTo(-1, 5);
  });

  it('should handle canvas offset', () => {
    const result = convertMouseCoordinates(
      350, 250,
      { left: 100, top: 100, width: 500, height: 300 }
    );
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });
});

describe('Property Info Formatting', () => {
  // Helper function for formatting properties
  const formatClickInfo = (
    mouse: { x: number; y: number },
    event: { clientX: number; clientY: number },
    cameraPos: { x: number; y: number; z: number },
    sceneObjectCount: number
  ): Record<string, unknown> => {
    return {
      'Click Position': `${mouse.x.toFixed(2)}, ${mouse.y.toFixed(2)}`,
      'Pixel Position': `${event.clientX}, ${event.clientY}`,
      'Camera Position': {
        x: Math.round(cameraPos.x * 100) / 100,
        y: Math.round(cameraPos.y * 100) / 100,
        z: Math.round(cameraPos.z * 100) / 100,
      },
      'Scene Objects': sceneObjectCount,
    };
  };

  it('should format click info correctly', () => {
    const result = formatClickInfo(
      { x: 0.5, y: -0.3 },
      { clientX: 400, clientY: 250 },
      { x: 68.123, y: 23.456, z: -8.789 },
      15
    );

    expect(result['Click Position']).toBe('0.50, -0.30');
    expect(result['Pixel Position']).toBe('400, 250');
    expect(result['Camera Position']).toEqual({ x: 68.12, y: 23.46, z: -8.79 });
    expect(result['Scene Objects']).toBe(15);
  });

  it('should round camera position to 2 decimal places', () => {
    const result = formatClickInfo(
      { x: 0, y: 0 },
      { clientX: 0, clientY: 0 },
      { x: 1.23456789, y: 9.87654321, z: -5.55555555 },
      0
    );

    const cameraPos = result['Camera Position'] as { x: number; y: number; z: number };
    expect(cameraPos.x).toBe(1.23);
    expect(cameraPos.y).toBe(9.88);
    expect(cameraPos.z).toBe(-5.56);
  });
});

describe('Known IFC Files List', () => {
  const knownIfcFiles = [
    '3D-omgeving.nl-3DBAG.ifc',
    '3D-omgeving.nl-BAG-Pand.ifc',
    '3D-omgeving.nl-BGT.ifc',
    '3D-omgeving.nl-BRK-Perceel.ifc',
    '3D-omgeving.nl-DSO-Enkelbestemming.ifc',
    '3D-omgeving.nl-DSO-Maatvoering.ifc',
    '3D-omgeving.nl-GEO-Nulpunt.ifc'
  ];

  it('should have correct number of known files', () => {
    expect(knownIfcFiles).toHaveLength(7);
  });

  it('should have all files with .ifc extension', () => {
    knownIfcFiles.forEach(file => {
      expect(file).toMatch(/\.ifc$/i);
    });
  });

  it('should have unique file names', () => {
    const uniqueFiles = new Set(knownIfcFiles);
    expect(uniqueFiles.size).toBe(knownIfcFiles.length);
  });

  it('should follow naming convention', () => {
    knownIfcFiles.forEach(file => {
      expect(file).toMatch(/^3D-omgeving\.nl-[A-Z]+/);
    });
  });
});
