import { useEffect, useState, useCallback } from 'react';
import * as OBC from '@thatopen/components';
import type { SelectionMap, ClassificationStore } from '../types/viewer.types';
import * as Classification from '../classification';

export interface UseClassifierReturn {
  /** All classification labels */
  labels: string[];
  /** Currently active/selected label */
  activeLabel: string | null;
  /** Classification store (label -> Set of GUIDs) */
  store: ClassificationStore;
  /** Set the active label */
  setActiveLabel: (label: string | null) => void;
  /** Load classifications from JSON file */
  loadFromFile: (file: File) => Promise<void>;
  /** Load classifications from URL */
  loadFromUrl: (url: string) => Promise<void>;
  /** Add current selection to a specific label */
  addSelectionToLabel: (label: string, selection: SelectionMap) => Promise<void>;
  /** Remove current selection from a specific label */
  removeSelectionFromLabel: (label: string, selection: SelectionMap) => Promise<void>;
  /** Get items (as SelectionMap) for a specific label */
  getItemsByLabel: (label: string) => Promise<SelectionMap>;
  /** Export classifications as JSON file */
  exportClassifications: () => void;
  /** Get count of items in a label (stored GUIDs) */
  getLabelCount: (label: string) => number;
  /** Get count of items in fragments matching label GUIDs */
  getLabelCountInFragments: (label: string) => Promise<number>;
}

/**
 * Custom hook for managing IFC object classifications
 * 
 * Handles:
 * - Classification loading from JSON
 * - Assigning objects to labels
 * - Retrieving objects by label
 * - Active label tracking
 */
export function useClassifier(

  fragmentsManager: OBC.FragmentsManager | null
): UseClassifierReturn {
  const [labels, setLabels] = useState<string[]>([]);
  const [activeLabel, setActiveLabelState] = useState<string | null>(null);
  const [store, setStore] = useState<ClassificationStore>(new Map());

  // Initialize classification system
  useEffect(() => {
    if (!fragmentsManager) return;

    const onChange = () => {
      setLabels(Classification.getLabels());
      setStore(new Map(Classification.getStore()));
    };

    Classification.initClassification(fragmentsManager, onChange);
    
    // Initial sync
    onChange();
  }, [fragmentsManager]);

  const setActiveLabel = useCallback((label: string | null) => {
    setActiveLabelState(label);
    if (label) {
      Classification.setActiveLabel(label);
    }
  }, []);

  const loadFromFile = useCallback(async (file: File) => {
    await Classification.loadClassificationsFromFile(file);
    // State will update via onChange callback
  }, []);

  const loadFromUrl = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const blob = new Blob([text], { type: 'application/json' });
      const file = new File([blob], 'classifications.json', { type: 'application/json' });
      await Classification.loadClassificationsFromFile(file);
      console.log('[useClassifier] Loaded classifications from URL:', url);
    } catch (error) {
      console.error('[useClassifier] Failed to load classifications from URL:', error);
    }
  }, []);

  const addSelectionToLabel = useCallback(async (label: string, selection: SelectionMap) => {
    console.log('[useClassifier] addSelectionToLabel called:', { label, selection });
    
    if (!fragmentsManager) {
      console.warn('[useClassifier] No fragmentsManager');
      return;
    }
    
    const labelSet = Classification.getStore().get(label);
    if (!labelSet) {
      // Create new label if it doesn't exist
      console.log('[useClassifier] Creating new label:', label);
      Classification.getStore().set(label, new Set());
    }

    // Get GUIDs from selection
    let guidCount = 0;
    for (const [modelId, localIds] of Object.entries(selection)) {
      console.log(`[useClassifier] Processing model ${modelId} with ${localIds.size} items`);
      const model = fragmentsManager.list.get(modelId);
      if (!model) {
        console.warn(`[useClassifier] Model not found: ${modelId}`);
        continue;
      }

      const items = await model.getItemsData([...localIds]);
      console.log(`[useClassifier] Got ${items.length} items data`);
      
      for (const item of items) {
        // Use _guid property (with underscore)
        const guidProp = item._guid;
        
        if (guidProp && typeof guidProp === 'object' && 'value' in guidProp) {
          const guid = guidProp.value;
          if (typeof guid === "string") {
            Classification.getStore().get(label)!.add(guid);
            guidCount++;
            if (guidCount <= 3) {
              console.log(`[useClassifier] Added GUID: ${guid}`);
            }
          }
        }
      }
    }

    console.log(`[useClassifier] Total GUIDs added: ${guidCount}`);

    // Trigger update
    setStore(new Map(Classification.getStore()));
  }, [fragmentsManager]);

  const removeSelectionFromLabel = useCallback(async (label: string, selection: SelectionMap) => {
    console.log('[useClassifier] removeSelectionFromLabel called:', { label, selection });
    
    if (!fragmentsManager) {
      console.warn('[useClassifier] No fragmentsManager');
      return;
    }
    
    const labelSet = Classification.getStore().get(label);
    if (!labelSet) {
      console.warn('[useClassifier] Label not found:', label);
      return;
    }

    // Get GUIDs from selection and remove them
    let guidCount = 0;
    for (const [modelId, localIds] of Object.entries(selection)) {
      const model = fragmentsManager.list.get(modelId);
      if (!model) {
        console.warn(`[useClassifier] Model not found: ${modelId}`);
        continue;
      }

      const items = await model.getItemsData([...localIds]);
      
      for (const item of items) {
        const guidProp = item._guid;
        
        if (guidProp && typeof guidProp === 'object' && 'value' in guidProp) {
          const guid = guidProp.value;
          if (typeof guid === "string" && labelSet.has(guid)) {
            labelSet.delete(guid);
            guidCount++;
          }
        }
      }
    }

    console.log(`[useClassifier] Total GUIDs removed: ${guidCount}`);

    // Trigger update
    setStore(new Map(Classification.getStore()));
  }, [fragmentsManager]);

  const getItemsByLabel = useCallback(async (label: string): Promise<SelectionMap> => {
    return await Classification.getItemsByLabel(label);
  }, []);

  const exportClassifications = useCallback(() => {
    Classification.exportClassificationsJSON();
  }, []);

  const getLabelCount = useCallback((label: string): number => {
    const labelSet = store.get(label);
    return labelSet ? labelSet.size : 0;
  }, [store]);

  const getLabelCountInFragments = useCallback(async (label: string): Promise<number> => {
    if (!fragmentsManager) return 0;
    
    const guids = store.get(label);
    if (!guids || guids.size === 0) return 0;

    let count = 0;
    
    // For each model, count items with matching GUIDs
    for (const [, model] of fragmentsManager.list) {
      const allIds = await model.getItemsIdsWithGeometry();
      const items = await model.getItemsData(allIds);
      
      for (const item of items) {
        const guidEntry = item._guid;
        if (guidEntry && !Array.isArray(guidEntry) && "value" in guidEntry) {
          const guid = (guidEntry as { value: unknown }).value;
          if (typeof guid === "string" && guids.has(guid)) {
            count++;
          }
        }
      }
    }

    return count;
  }, [fragmentsManager, store]);

  return {
    labels,
    activeLabel,
    store,
    setActiveLabel,
    loadFromFile,
    loadFromUrl,
    addSelectionToLabel,
    removeSelectionFromLabel,
    getItemsByLabel,
    exportClassifications,
    getLabelCount,
    getLabelCountInFragments,
  };
}
