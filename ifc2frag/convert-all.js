#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { IfcImporter } from "@thatopen/fragments";
import * as WEBIFC from "web-ifc";

const SOURCE_DIR = "../ifc-viewer/public/models/source-models";
const OUTPUT_DIR = "../ifc-viewer/public/models/model-geometry/fragments";
const METADATA_DIR = "../ifc-viewer/public/models/model-properties";

/**
 * Extract IFCMAPCONVERSION data from IFC file
 */
async function extractMapConversion(inputPath) {
  const api = new WEBIFC.IfcAPI();
  await api.Init();

  const data = fs.readFileSync(inputPath);
  const modelID = api.OpenModel(data);

  try {
    // Find IFCMAPCONVERSION entities
    const mapConversionIds = api.GetLineIDsWithType(modelID, WEBIFC.IFCMAPCONVERSION);

    if (mapConversionIds.size() === 0) {
      console.log("    ⚠ No IFCMAPCONVERSION found");
      return null;
    }

    const mapConversionId = mapConversionIds.get(0);
    const mapConversion = api.GetLine(modelID, mapConversionId);

    // Extract transformation parameters
    const result = {
      eastings: mapConversion.Eastings?.value ?? 0,
      northings: mapConversion.Northings?.value ?? 0,
      orthogonalHeight: mapConversion.OrthogonalHeight?.value ?? 0,
      xAxisAbscissa: mapConversion.XAxisAbscissa?.value ?? null,
      xAxisOrdinate: mapConversion.XAxisOrdinate?.value ?? null,
      scale: mapConversion.Scale?.value ?? null,
    };

    // Try to get CRS info
    if (mapConversion.TargetCRS?.value) {
      const crsId = mapConversion.TargetCRS.value;
      const crs = api.GetLine(modelID, crsId);
      result.crsName = crs.Name?.value ?? null;
      result.description = crs.Description?.value ?? null;
    }

    console.log(`    ℹ Map conversion: E=${result.eastings}, N=${result.northings}, H=${result.orthogonalHeight}`);
    if (result.crsName) {
      console.log(`    ℹ CRS: ${result.crsName}`);
    }

    return result;
  } finally {
    api.CloseModel(modelID);
  }
}

async function convertFile(inputPath, outputPath, metadataPath) {
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

  importer.relations.set(WEBIFC.IFCRELASSOCIATESMATERIAL, {
    forRelating: "RelatingMaterial",
    forRelated: "RelatedObjects",
  });

  // Extract map conversion before processing
  const mapConversion = await extractMapConversion(inputPath);

  const bytes = new Uint8Array(fs.readFileSync(inputPath));
  const fragBytes = await importer.process({ bytes });
  fs.writeFileSync(outputPath, Buffer.from(fragBytes));

  // Save map conversion metadata
  if (mapConversion && metadataPath) {
    fs.writeFileSync(metadataPath, JSON.stringify(mapConversion, null, 2));
    console.log(`    ✔ Saved metadata: ${path.basename(metadataPath)}`);
  }
}

async function run() {
  const sourceDir = path.resolve(SOURCE_DIR);
  const outputDir = path.resolve(OUTPUT_DIR);
  const metadataDir = path.resolve(METADATA_DIR);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(metadataDir, { recursive: true });

  const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith(".ifc"));

  if (files.length === 0) {
    console.log("No IFC files found in source-models");
    return;
  }

  console.log(`Found ${files.length} IFC file(s) to convert\n`);

  for (const file of files) {
    const inputPath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file.replace(/\.ifc$/i, ".frag"));
    const metadataPath = path.join(metadataDir, file.replace(/\.ifc$/i, "-mapconversion.json"));

    console.log(`Converting: ${file}`);
    try {
      await convertFile(inputPath, outputPath, metadataPath);
      console.log(`  ✔ Saved: ${path.basename(outputPath)}\n`);
    } catch (err) {
      console.error(`  ✖ Failed: ${err.message}\n`);
      console.error(err.stack);
    }
  }

  console.log("Done!");
}

run();
