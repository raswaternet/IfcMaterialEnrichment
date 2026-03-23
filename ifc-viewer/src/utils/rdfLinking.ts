/**
 * Example: Linking viewer selection to RDF material data.
 *
 * This shows how to use the GUID utilities to query RDF data
 * for a selected element in the viewer.
 */

import { makeInstanceIri } from "./ifcGuid";

// IFCX material namespace
const IFC_MAT_NS = "https://standards.buildingsmart.org/ifc/ifc-mat/ifc-mat@v1.0.0.ifcx#";

/**
 * Get material IRI for an element from RDF data.
 *
 * @param globalId - IFC GlobalId from fragments
 * @param rdfData - Parsed RDF data (e.g., from rdflib.js or N3.js)
 * @returns Material IRI or null
 */
export function getMaterialForElement(
  globalId: string,
  rdfData: Map<string, Map<string, string[]>>
): string | null {
  const elementIri = makeInstanceIri(globalId);
  const hasMaterial = `${IFC_MAT_NS}hasMaterial`;

  const predicates = rdfData.get(elementIri);
  if (predicates) {
    const materials = predicates.get(hasMaterial);
    if (materials && materials.length > 0) {
      return materials[0];
    }
  }
  return null;
}

/**
 * Example usage with @thatopen/fragments:
 *
 * ```typescript
 * import * as OBC from "@thatopen/components";
 * import { guidToUuid, makeInstanceIri } from "./utils/ifcGuid";
 *
 * // When user selects an element
 * highlighter.events.select.onHighlight.add(async (fragmentIdMap) => {
 *   for (const [fragmentId, expressIds] of fragmentIdMap) {
 *     const model = fragments.list.get(modelId);
 *     if (!model) continue;
 *
 *     for (const expressId of expressIds) {
 *       // Get element attributes including GUID
 *       const attrs = await model.getSequenced("attributes", [expressId]);
 *       const guid = attrs.attributes?.[0]?.guid;
 *
 *       if (guid) {
 *         const uuid = guidToUuid(guid);
 *         const instanceIri = makeInstanceIri(guid);
 *
 *         // Query RDF for material
 *         const material = getMaterialForElement(guid, rdfData);
 *         console.log(`Element ${uuid} has material: ${material}`);
 *       }
 *     }
 *   }
 * });
 * ```
 */
