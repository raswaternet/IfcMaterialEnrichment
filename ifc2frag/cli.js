#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { IfcImporter } from "@thatopen/fragments";

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

  console.log("Reading IFC...");
  const bytes = new Uint8Array(fs.readFileSync(input));

  console.log("Converting to Fragments...");
  const fragBytes = await importer.process({ bytes });

  fs.writeFileSync(output, Buffer.from(fragBytes));

  console.log(`✔ Done! Saved to ${output}`);
}

run();
