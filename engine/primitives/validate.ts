import type { PrimitiveConfig, PrimitiveDef } from './types';

export class ValidationError extends Error {}

const VALID_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

export function validateConfig(config: PrimitiveConfig): void {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Config must be an object.');
  }
  if (!config.primitives || typeof config.primitives !== 'object') {
    throw new ValidationError('Config.primitives must be an object.');
  }

  const names = Object.keys(config.primitives);
  if (names.length === 0) {
    throw new ValidationError('Config.primitives must define at least one primitive.');
  }

  const seenLower = new Map<string, string>();
  for (const name of names) {
    if (!VALID_NAME_RE.test(name)) {
      throw new ValidationError(
        `Invalid primitive name: "${name}". Must be PascalCase (start with uppercase, alphanumerics only).`,
      );
    }
    const lower = name.toLowerCase();
    const existing = seenLower.get(lower);
    if (existing) {
      throw new ValidationError(
        `Duplicate primitive name (case-insensitive): "${existing}" and "${name}".`,
      );
    }
    seenLower.set(lower, name);

    validatePrimitive(name, config.primitives[name]);
  }
}

function validatePrimitive(name: string, def: PrimitiveDef): void {
  if (!def || typeof def !== 'object') {
    throw new ValidationError(`Primitive "${name}" must be an object.`);
  }
  if (typeof def.tag !== 'string' || def.tag.length === 0) {
    throw new ValidationError(`Primitive "${name}" must have a non-empty string \`tag\`.`);
  }

  const hasClasses = Array.isArray(def.matchClasses) && def.matchClasses.length > 0;
  const hasTags = Array.isArray(def.matchTags) && def.matchTags.length > 0;
  if (!hasClasses && !hasTags) {
    throw new ValidationError(
      `Primitive "${name}" must define at least one of \`matchClasses\` or \`matchTags\`.`,
    );
  }

  if (def.matchClasses !== undefined) {
    assertStringArray(name, 'matchClasses', def.matchClasses);
  }
  if (def.matchTags !== undefined) {
    assertStringArray(name, 'matchTags', def.matchTags);
  }
  if (def.variants !== undefined) {
    assertStringRecord(name, 'variants', def.variants);
  }
  if (def.sizes !== undefined) {
    assertStringRecord(name, 'sizes', def.sizes);
  }
  if (def.passThroughClasses !== undefined && typeof def.passThroughClasses !== 'boolean') {
    throw new ValidationError(
      `Primitive "${name}".passThroughClasses must be a boolean if provided.`,
    );
  }
}

function assertStringArray(name: string, field: string, value: unknown): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Primitive "${name}".${field} must be an array of strings.`);
  }
  for (const v of value) {
    if (typeof v !== 'string' || v.length === 0) {
      throw new ValidationError(
        `Primitive "${name}".${field} entries must be non-empty strings.`,
      );
    }
  }
}

function assertStringRecord(
  name: string,
  field: string,
  value: Record<string, unknown>,
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(
      `Primitive "${name}".${field} must be an object mapping prop names to class names.`,
    );
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    throw new ValidationError(
      `Primitive "${name}".${field} must contain at least one entry if provided.`,
    );
  }
  for (const k of keys) {
    const v = value[k];
    if (typeof v !== 'string' || v.length === 0) {
      throw new ValidationError(
        `Primitive "${name}".${field}.${k} must be a non-empty string class name.`,
      );
    }
  }
}
