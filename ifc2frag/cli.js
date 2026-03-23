#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { IfcImporter } from "@thatopen/fragments";
import * as WEBIFC from "web-ifc";

/**
 * Extract IFCMAPCONVERSION data from IFC file
 */
async function extractMapConversion(inputPath) {
  const api = new WEBIFC.IfcAPI();
  await api.Init();

  const data = fs.readFileSync(inputPath);
  const modelID = api.OpenModel(data);

  try {
    const mapConversionIds = api.GetLineIDsWithType(modelID, WEBIFC.IFCMAPCONVERSION);

    if (mapConversionIds.size() === 0) {
      console.log("⚠ No IFCMAPCONVERSION found in file");
      return null;
    }

    const mapConversionId = mapConversionIds.get(0);
    const mapConversion = api.GetLine(modelID, mapConversionId);

    const result = {
      eastings: mapConversion.Eastings?.value ?? 0,
      northings: mapConversion.Northings?.value ?? 0,
      orthogonalHeight: mapConversion.OrthogonalHeight?.value ?? 0,
      xAxisAbscissa: mapConversion.XAxisAbscissa?.value ?? null,
      xAxisOrdinate: mapConversion.XAxisOrdinate?.value ?? null,
      scale: mapConversion.Scale?.value ?? null,
    };

    if (mapConversion.TargetCRS?.value) {
      const crsId = mapConversion.TargetCRS.value;
      const crs = api.GetLine(modelID, crsId);
      result.crsName = crs.Name?.value ?? null;
      result.description = crs.Description?.value ?? null;
    }

    console.log(`ℹ Map conversion: E=${result.eastings}, N=${result.northings}, H=${result.orthogonalHeight}`);
    if (result.crsName) {
      console.log(`ℹ CRS: ${result.crsName}`);
    }

    return result;
  } finally {
    api.CloseModel(modelID);
  }
}

async function run() {
  const input = process.argv[2];
  const output = process.argv[3];

  if (!input || !output) {
    console.error("Usage: ifc2frag <input.ifc> <output.frag>");
    process.exit(1);
  }

  const importer = new IfcImporter();

  importer.wasm = {
    absolute: true,
    path: path.resolve("node_modules/web-ifc/") + "/",
  };

  // Configure web-ifc to NOT translate to origin - keep georeferenced coordinates
  importer.webIfcSettings = {
    COORDINATE_TO_ORIGIN: false,
  };

  // Disable distance threshold to allow large EPSG:28992 coordinates
  importer.distanceThreshold = null;

  // Include material relations (same as browser IfcLoader does)
  importer.relations.set(WEBIFC.IFCRELASSOCIATESMATERIAL, {
    forRelating: "RelatingMaterial",
    forRelated: "RelatedObjects",
  });

  // Optionally include all attributes (increases file size but preserves more data)
  // importer.addAllAttributes();

  console.log("Extracting map conversion...");
  const mapConversion = await extractMapConversion(input);

  console.log("Reading IFC...");
  const bytes = new Uint8Array(fs.readFileSync(input));

  console.log("Converting to Fragments...");
  const fragBytes = await importer.process({ bytes });

  fs.writeFileSync(output, Buffer.from(fragBytes));

  // Save map conversion metadata as JSON sidecar
  if (mapConversion) {
    const metadataPath = output.replace(/\.frag$/, "-mapconversion.json");
    fs.writeFileSync(metadataPath, JSON.stringify(mapConversion, null, 2));
    console.log(`✔ Saved metadata: ${metadataPath}`);
  }

  console.log(`✔ Done! Saved to ${output}`);
}

run();
