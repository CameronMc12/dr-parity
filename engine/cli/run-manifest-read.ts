/**
 * Read helpers for `.runs/<runId>/manifest.json`.
 *
 * The full writer lives in `run-manifest.ts`. The harvest scanner needs a
 * cheaper, path based reader that returns the typed manifest or throws on
 * schemaVersion mismatch. Re exports the manifest types so the harvest
 * module stays decoupled from the writer module.
 */

import { promises as fs } from "node:fs";
import {
  type RunManifest,
  type RunManifestStage,
  ManifestSchemaError,
  RUN_MANIFEST_SCHEMA_VERSION,
} from "./run-manifest.js";

export type { RunManifest, RunManifestStage } from "./run-manifest.js";

export async function readManifestAt(
  filePath: string,
): Promise<RunManifest | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
  const parsed = JSON.parse(raw) as RunManifest;
  if (parsed.schemaVersion !== RUN_MANIFEST_SCHEMA_VERSION) {
    throw new ManifestSchemaError(
      parsed.runId ?? "unknown",
      parsed.schemaVersion,
      RUN_MANIFEST_SCHEMA_VERSION,
    );
  }
  return parsed;
}
