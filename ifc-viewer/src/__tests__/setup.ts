import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock canvas getContext - simplified version that returns proper types
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-expect-error - Mocking canvas context for tests
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
    if (type === '2d') {
      return {
        fillStyle: '',
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
      };
    }
    // Return minimal WebGL context mock
    return {
      canvas: document.createElement('canvas'),
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      getExtension: vi.fn(),
      getParameter: vi.fn((param) => {
        // Mock common WebGL parameters
        if (param === 0x8B4C) return 16; // MAX_VERTEX_UNIFORM_VECTORS
        if (param === 0x8DFD) return 16; // MAX_TEXTURE_IMAGE_UNITS
        return null;
      }),
      getShaderPrecisionFormat: vi.fn(() => ({
        precision: 23,
        rangeMin: 127,
        rangeMax: 127,
      })),
      createShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      useProgram: vi.fn(),
      getAttribLocation: vi.fn(),
      getUniformLocation: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      viewport: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createBuffer: vi.fn(),
      createTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      scissor: vi.fn(),
      depthMask: vi.fn(),
      depthFunc: vi.fn(),
      frontFace: vi.fn(),
    };
  });
}

