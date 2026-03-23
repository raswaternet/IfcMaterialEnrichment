/**
 * IFC GlobalId ↔ UUID conversion utilities.
 *
 * IFC GlobalIds are 22-character base64-encoded 128-bit identifiers.
 * UUIDs are the standard 36-character hexadecimal representation with dashes.
 *
 * These utilities allow bidirectional conversion for linking IFC elements
 * to RDF/Linked Data resources that use UUID-based IRIs.
 */

// Base64 character set used by IFC GlobalId encoding
const IFC_GUID_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/**
 * Convert IFC GlobalId (22-char base64) to standard UUID format.
 *
 * @param globalId - IFC GlobalId string (e.g., "0YvctS3H8Hm00x3$2o_GU2")
 * @returns UUID string with dashes (e.g., "22e66ddc-0d12-11c0-003b-0f2f90000782")
 */
export function guidToUuid(globalId: string): string {
  if (globalId.length !== 22) {
    throw new Error(`Invalid IFC GlobalId length: ${globalId.length}, expected 22`);
  }

  let num = BigInt(0);

  // Decode base64 to 128-bit number
  for (let i = 0; i < 22; i++) {
    const charIndex = IFC_GUID_CHARS.indexOf(globalId[i]);
    if (charIndex === -1) {
      throw new Error(`Invalid character in GlobalId: ${globalId[i]}`);
    }
    num = num * BigInt(64) + BigInt(charIndex);
  }

  // Convert to 32-char hex string
  const hex = num.toString(16).padStart(32, "0");

  // Format as UUID with dashes
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Convert UUID to IFC GlobalId (22-char base64).
 *
 * @param uuid - UUID string with or without dashes
 * @returns IFC GlobalId string (22 characters)
 */
export function uuidToGuid(uuid: string): string {
  // Remove dashes and convert to BigInt
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) {
    throw new Error(`Invalid UUID hex length: ${hex.length}, expected 32`);
  }

  let num = BigInt("0x" + hex);

  // Encode as base64
  const chars: string[] = [];
  for (let i = 0; i < 22; i++) {
    chars.unshift(IFC_GUID_CHARS[Number(num % BigInt(64))]);
    num = num / BigInt(64);
  }

  return chars.join("");
}

// Instance namespace for this project
export const INSTANCE_BASE = "https://raswaternet.github.io/IfcMaterialEnrichment/";

/**
 * Create a full IRI for an IFC element.
 *
 * @param globalId - IFC GlobalId
 * @param base - Base namespace for instances
 * @returns Full IRI string
 */
export function makeInstanceIri(
  globalId: string,
  base: string = INSTANCE_BASE
): string {
  return `${base}${guidToUuid(globalId)}`;
}

/**
 * Extract UUID from an instance IRI.
 *
 * @param iri - Full IRI string
 * @param base - Base namespace to strip
 * @returns UUID string, or null if IRI doesn't match the base
 */
export function extractUuidFromIri(
  iri: string,
  base: string = INSTANCE_BASE
): string | null {
  if (iri.startsWith(base)) {
    return iri.slice(base.length);
  }
  return null;
}

/**
 * Convert instance IRI to IFC GlobalId.
 *
 * @param iri - Full IRI string
 * @param base - Base namespace to strip
 * @returns IFC GlobalId, or null if conversion fails
 */
export function iriToGuid(
  iri: string,
  base: string = INSTANCE_BASE
): string | null {
  const uuid = extractUuidFromIri(iri, base);
  if (uuid) {
    try {
      return uuidToGuid(uuid);
    } catch {
      return null;
    }
  }
  return null;
}
