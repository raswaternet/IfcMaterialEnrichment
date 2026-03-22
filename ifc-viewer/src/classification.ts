import type * as OBC from "@thatopen/components";

export type ClassificationStore = Map<string, Set<string>>;

const store: ClassificationStore = new Map();
let _activeLabel: string | null = null;
let _labels: string[] = [];
let _onChange: (() => void) | null = null;
let _fragmentsManager: OBC.FragmentsManager | null = null;

export const initClassification = (
  fragmentsManager: OBC.FragmentsManager,
  onChange: () => void,
) => {
  _fragmentsManager = fragmentsManager;
  _onChange = onChange;
};

export const getLabels = () => _labels;
export const getActiveLabel = () => _activeLabel;
export const getStore = () => store;

export const setActiveLabel = (label: string) => {
  _activeLabel = label;
  _onChange?.();
};

export const loadClassificationsFromFile = async (file: File) => {
  const text = await file.text();
  let parsed: string[] = [];

  if (file.name.endsWith(".json")) {
    try {
      const json = JSON.parse(text) as unknown;
      if (Array.isArray(json)) {
        parsed = (json as unknown[]).filter(
          (x): x is string => typeof x === "string",
        );
      }
    } catch {
      console.warn("Failed to parse classification JSON");
      return;
    }
  } else {
    // CSV or plain text: one label per line
    parsed = text
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  _labels = parsed;
  for (const label of _labels) {
    if (!store.has(label)) store.set(label, new Set());
  }
  _onChange?.();
};

export const assignToActive = async (
  selectionMap: Record<string, Set<number>>,
) => {
  if (!_activeLabel || !_fragmentsManager) return;
  const set = store.get(_activeLabel)!;

  for (const [modelId, localIds] of Object.entries(selectionMap)) {
    const model = _fragmentsManager.list.get(modelId);
    if (!model) continue;

    const items = await model.getItemsData([...localIds]);
    for (const item of items) {
      const guidEntry = item["GlobalId"];
      if (guidEntry && !Array.isArray(guidEntry) && "value" in guidEntry) {
        const guid = (guidEntry as { value: unknown }).value;
        if (typeof guid === "string") set.add(guid);
      }
    }
  }

  _onChange?.();
};

export const getItemsByLabel = async (
  label: string,
): Promise<Record<string, Set<number>>> => {
  if (!_fragmentsManager) return {};
  
  const guids = store.get(label);
  if (!guids || guids.size === 0) return {};

  const result: Record<string, Set<number>> = {};
  
  // For each model, find items with matching GUIDs
  for (const [modelId, model] of _fragmentsManager.list) {
    const allIds = await model.getItemsIdsWithGeometry();
    const items = await model.getItemsData(allIds);
    
    const matchingIds = new Set<number>();
    for (const item of items) {
      const guidEntry = item._guid;
      if (guidEntry && !Array.isArray(guidEntry) && "value" in guidEntry) {
        const guid = (guidEntry as { value: unknown }).value;
        if (typeof guid === "string" && guids.has(guid)) {
          const idEntry = item._localId;
          if (idEntry && !Array.isArray(idEntry) && "value" in idEntry) {
            const localId = (idEntry as { value: unknown }).value;
            if (typeof localId === "number") {
              matchingIds.add(localId);
            }
          }
        }
      }
    }
    
    if (matchingIds.size > 0) {
      result[modelId] = matchingIds;
    }
  }

  return result;
};

export const exportClassificationsJSON = () => {
  const obj = Object.fromEntries([...store].map(([k, v]) => [k, [...v]]));
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "classifications.json";
  a.click();
  URL.revokeObjectURL(url);
};
