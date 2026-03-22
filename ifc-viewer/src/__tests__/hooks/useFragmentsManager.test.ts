import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useFragmentsManager } from '../../hooks/useFragmentsManager';

/**
 * Tests for useFragmentsManager hook.
 * 
 * Focus: Business logic (state management, loading tracking)
 * Skip: 3D rendering and ThatOpen initialization (tested manually)
 */
describe('useFragmentsManager', () => {
  beforeEach(() => {
    // Reset before each test
  });

  it('should return initial state when viewerCore is null', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(result.current.fragments).toBeNull();
    expect(result.current.ifcLoader).toBeNull();
    expect(result.current.models).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should provide loadIFC function', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(typeof result.current.loadIFC).toBe('function');
  });

  it('should provide loadIFCFromUrl function', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(typeof result.current.loadIFCFromUrl).toBe('function');
  });

  it('should provide clearAll function', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(typeof result.current.clearAll).toBe('function');
  });

  it('should set error when loadIFC is called without initialization', async () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    const mockFile = new File(['test'], 'test.ifc', { type: 'application/octet-stream' });

    await act(async () => {
      await result.current.loadIFC(mockFile);
    });

    expect(result.current.error).toBe('IFC loader not initialized');
  });

  it('should set error when loadIFCFromUrl is called without initialization', async () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    await act(async () => {
      await result.current.loadIFCFromUrl('/test.ifc', 'test.ifc');
    });

    expect(result.current.error).toBe('IFC loader not initialized');
  });

  it('should initialize models array as empty', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(Array.isArray(result.current.models)).toBe(true);
    expect(result.current.models.length).toBe(0);
  });

  it('should accept custom options', () => {
    const customOptions = {
      wasmPath: 'https://custom.cdn/web-ifc/',
      workerUrl: '/custom-worker.mjs',
      autoLoad: true,
    };

    const { result } = renderHook(() =>
      useFragmentsManager(null, customOptions)
    );

    // Options are used internally, just verify hook initializes
    expect(result.current).toBeDefined();
  });

  it('should call clearAll without errors when fragments is null', () => {
    const { result } = renderHook(() => useFragmentsManager(null));

    expect(() => {
      act(() => {
        result.current.clearAll();
      });
    }).not.toThrow();
  });

  // Note: Full initialization tests with real ThatOpen components
  // should be done via manual browser testing or E2E tests.
  // These unit tests verify the business logic layer only.
});
