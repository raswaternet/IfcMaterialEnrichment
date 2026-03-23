import { useEffect, useState, useCallback, useRef } from 'react';
import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import type { ViewerCore, ModelInfo } from '../types/viewer.types';
import { loadMapConversion, applyGeoTransform } from '../utils/georeferencing';
import { SCENE_ORIGIN_EPSG28992 } from '../config/scene';

export interface UseFragmentsManagerOptions {
  wasmPath?: string;
  workerUrl?: string;
}

export interface LoadingProgress {
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  percentage: number;
}

export interface UseFragmentsManagerReturn {
  fragments: OBC.FragmentsManager | null;
  ifcLoader: OBC.IfcLoader | null;
  models: ModelInfo[];
  isLoading: boolean;
  loadingProgress: LoadingProgress | null;
  isInitialized: boolean;
  loadIFC: (file: File) => Promise<void>;
  loadIFCFromUrl: (url: string, fileName: string) => Promise<void>;
  loadMultipleFromUrls: (urls: Array<{ url: string; fileName: string }>) => Promise<void>;
  loadFragment: (file: File) => Promise<void>;
  loadFragmentFromUrl: (url: string, fileName: string) => Promise<void>;
  clearAll: () => void;
  error: string | null;
}

/**
 * Custom hook for managing IFC fragments and models.
 * 
 * This hook handles:
 * - FragmentsManager initialization
 * - IFC loader setup
 * - Model list tracking (business logic)
 * - Loading state management
 * - File loading operations
 * 
 * Note: Does not handle 3D rendering - that's in useViewerCore.
 * Focus is on data management and loading state.
 */
export function useFragmentsManager(
  viewerCore: ViewerCore | null,
  options: UseFragmentsManagerOptions = {}
): UseFragmentsManagerReturn {
  const {
    wasmPath = 'https://unpkg.com/web-ifc@0.0.71/',
    workerUrl = 'https://thatopen.github.io/engine_fragment/resources/worker.mjs',
  } = options;

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const ifcLoaderRef = useRef<OBC.IfcLoader | null>(null);
  const initializedRef = useRef(false);
  const workerBlobUrlRef = useRef<string | null>(null);

  // Track scene origin in EPSG:28992 - set by first model or config
  const sceneOriginRef = useRef<{ eastings: number; northings: number; height: number } | null>(
    SCENE_ORIGIN_EPSG28992
  );

  // Initialize FragmentsManager and IfcLoader
  useEffect(() => {
    if (!viewerCore || initializedRef.current) return;

    const init = async () => {
      try {
        const { components, world } = viewerCore;

        // Fetch worker from CDN and create blob URL to avoid CORS issues
        const workerResponse = await fetch(workerUrl);
        if (!workerResponse.ok) {
          throw new Error(`Failed to fetch worker: ${workerResponse.status}`);
        }
        const workerBlob = await workerResponse.blob();
        const workerFile = new File([workerBlob], 'worker.mjs', { type: 'text/javascript' });
        const workerBlobUrl = URL.createObjectURL(workerFile);
        workerBlobUrlRef.current = workerBlobUrl;

        // Get FragmentsManager
        const fragments = components.get(OBC.FragmentsManager);
        fragments.init(workerBlobUrl);
        fragmentsRef.current = fragments;

        // Get IfcLoader
        const ifcLoader = components.get(OBC.IfcLoader);
        await ifcLoader.setup({
          autoSetWasm: false,
          wasm: {
            path: wasmPath,
            absolute: true,
          },
        });
        ifcLoaderRef.current = ifcLoader;

        // Listen for new models being added
        fragments.list.onItemSet.add(({ key: modelId, value: model }) => {
          // Add model to scene
          // Type assertion needed: SimpleCamera.three is THREE.Camera but useCamera expects PerspectiveCamera
          model.useCamera(world.camera.three as unknown as THREE.PerspectiveCamera);
          world.scene.three.add(model.object);
          fragments.core.update(true);

          // Update model list
          const modelInfo: ModelInfo = {
            id: modelId,
            name: modelId,
            ifcFileName: modelId,
          };

          setModels((prev) => {
            // Check if model already exists
            if (prev.some((m) => m.id === modelInfo.id)) {
              return prev;
            }
            return [...prev, modelInfo];
          });
        });

        // Update camera on rest
        world.camera.controls?.addEventListener('rest', () => {
          fragments.core.update(true);
        });

        initializedRef.current = true;
        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing fragments manager:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    };

    init();

    return () => {
      // Cleanup if needed
      if (fragmentsRef.current) {
        // FragmentsManager cleanup
        fragmentsRef.current.dispose();
      }
      // Revoke worker blob URL to prevent memory leak
      if (workerBlobUrlRef.current) {
        URL.revokeObjectURL(workerBlobUrlRef.current);
        workerBlobUrlRef.current = null;
      }
    };
  }, [viewerCore, wasmPath, workerUrl]);

  /**
   * Load IFC file from File object
   */
  const loadIFC = useCallback(async (file: File) => {
    if (!ifcLoaderRef.current) {
      setError('IFC loader not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      await ifcLoaderRef.current.load(uint8Array, false, file.name);
    } catch (err) {
      console.error(`Error loading ${file.name}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load IFC file');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load IFC file from URL
   */
  const loadIFCFromUrl = useCallback(async (url: string, fileName: string) => {
    if (!ifcLoaderRef.current) {
      setError('IFC loader not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      await ifcLoaderRef.current.load(uint8Array, false, fileName);
    } catch (err) {
      console.error(`Error loading ${fileName}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load IFC file from URL');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load multiple IFC files from URLs in sequence
   */
  const loadMultipleFromUrls = useCallback(
    async (urls: Array<{ url: string; fileName: string }>) => {
      if (!ifcLoaderRef.current) {
        setError('IFC loader not initialized');
        return;
      }

      setIsLoading(true);
      setError(null);

      let successCount = 0;
      const totalFiles = urls.length;

      for (let i = 0; i < urls.length; i++) {
        const { url, fileName } = urls[i];

        try {
          // Update progress
          setLoadingProgress({
            currentFile: fileName,
            currentIndex: i,
            totalFiles,
            percentage: Math.round(((i) / totalFiles) * 100),
          });

          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to load ${fileName}: HTTP ${response.status}`);
            continue;
          }

          const buffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);

          await ifcLoaderRef.current.load(uint8Array, false, fileName);

          successCount++;
        } catch (err) {
          console.warn(`Error loading ${fileName}:`, err);
          // Continue with next file
        }
      }

      // Complete
      setLoadingProgress({
        currentFile: '',
        currentIndex: totalFiles,
        totalFiles,
        percentage: 100,
      });

      if (successCount === 0) {
        setError('Failed to load any models');
      }

      setIsLoading(false);
      setLoadingProgress(null);
    },
    []
  );

  /**
   * Load fragment file from File object
   */
  const loadFragment = useCallback(async (file: File) => {
    if (!fragmentsRef.current) {
      setError('Fragments manager not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      await fragmentsRef.current.core.load(uint8Array, {
        modelId: file.name,
      });
    } catch (err) {
      console.error(`Error loading fragment ${file.name}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load fragment file');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load fragment file from URL with georeferencing support
   */
  const loadFragmentFromUrl = useCallback(async (url: string, fileName: string) => {
    if (!fragmentsRef.current || !viewerCore) {
      setError('Fragments manager not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load map conversion metadata
      const mapConversion = await loadMapConversion(fileName);

      // Set scene origin from first model if not configured
      if (mapConversion && !sceneOriginRef.current) {
        sceneOriginRef.current = {
          eastings: mapConversion.eastings,
          northings: mapConversion.northings,
          height: mapConversion.orthogonalHeight,
        };
      }

      // Load fragment
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      await fragmentsRef.current.core.load(uint8Array, {
        modelId: fileName,
      });

      // Apply georeferencing transformation if we have mapconversion data
      if (mapConversion && sceneOriginRef.current) {
        const model = fragmentsRef.current.list.get(fileName);
        if (model) {
          applyGeoTransform(model.object, mapConversion, sceneOriginRef.current);
        }
      }

    } catch (err) {
      console.error(`Error loading fragment ${fileName}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load fragment from URL');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [viewerCore]);

  /**
   * Clear all models
   */
  const clearAll = useCallback(() => {
    if (fragmentsRef.current) {
      fragmentsRef.current.dispose();
      setModels([]);
      setError(null);
    }
  }, []);

  return {
    fragments: fragmentsRef.current,
    ifcLoader: ifcLoaderRef.current,
    models,
    isLoading,
    loadingProgress,
    isInitialized,
    loadIFC,
    loadIFCFromUrl,
    loadMultipleFromUrls,
    loadFragment,
    loadFragmentFromUrl,
    clearAll,
    error,
  };
}
