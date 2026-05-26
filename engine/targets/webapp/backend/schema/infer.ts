// JSON-shape inferrer. Given an array of sample objects, produce a field model
// (name, inferred type incl nullable/optional/enum candidates/nested) merged
// across all samples. Hand-rolled, no external codegen dependency.

export type ScalarKind = "string" | "number" | "boolean" | "null";

export interface FieldModel {
  name: string;
  /** Distinct scalar kinds seen across samples (excluding null). */
  kinds: Set<ScalarKind>;
  /** True when at least one sample had this key present with a null value. */
  nullable: boolean;
  /** True when at least one sample omitted this key entirely. */
  optional: boolean;
  /** True when any non-null value for this key was an array. */
  isArray: boolean;
  /** Merged model of array element objects, when the array held objects. */
  arrayItem?: ShapeModel;
  /** Merged model of nested object values (non-array objects). */
  nested?: ShapeModel;
  /** Distinct primitive string/number values, kept only while small (enum candidate). */
  enumCandidates?: Set<string | number>;
  /** Number of samples where the key was present (including null). */
  presentCount: number;
}

export interface ShapeModel {
  fields: Map<string, FieldModel>;
  /** Number of object samples merged into this shape. */
  sampleCount: number;
}

const ENUM_CAP = 24;

function scalarKind(value: unknown): ScalarKind | null {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function emptyField(name: string): FieldModel {
  return {
    name,
    kinds: new Set(),
    nullable: false,
    optional: false,
    isArray: false,
    enumCandidates: new Set(),
    presentCount: 0,
  };
}

function recordScalar(field: FieldModel, value: string | number | boolean): void {
  const kind = scalarKind(value);
  if (kind) field.kinds.add(kind);
  if (typeof value === "boolean") return; // booleans are their own enum
  if (!field.enumCandidates) return;
  field.enumCandidates.add(value as string | number);
  if (field.enumCandidates.size > ENUM_CAP) field.enumCandidates = undefined;
}

function mergeValue(field: FieldModel, value: unknown): void {
  if (value === null) {
    field.nullable = true;
    field.kinds.add("null");
    return;
  }
  if (Array.isArray(value)) {
    field.isArray = true;
    field.enumCandidates = undefined;
    for (const item of value) {
      if (isPlainObject(item)) {
        field.arrayItem = mergeObjectInto(field.arrayItem, item);
      }
    }
    return;
  }
  if (isPlainObject(value)) {
    field.enumCandidates = undefined;
    field.nested = mergeObjectInto(field.nested, value);
    return;
  }
  recordScalar(field, value as string | number | boolean);
}

function mergeObjectInto(
  existing: ShapeModel | undefined,
  obj: Record<string, unknown>,
): ShapeModel {
  const shape: ShapeModel = existing ?? { fields: new Map(), sampleCount: 0 };
  shape.sampleCount += 1;
  const keysSeen = new Set(Object.keys(obj));

  // Existing fields not present in this sample become optional.
  for (const [key, field] of shape.fields) {
    if (!keysSeen.has(key)) field.optional = true;
  }

  for (const [key, value] of Object.entries(obj)) {
    let field = shape.fields.get(key);
    if (!field) {
      field = emptyField(key);
      // A field appearing for the first time after other samples is optional.
      if (shape.sampleCount > 1) field.optional = true;
      shape.fields.set(key, field);
    }
    field.presentCount += 1;
    mergeValue(field, value);
  }
  return shape;
}

/** Merge an array of sample objects into a single shape model. */
export function inferShape(samples: ReadonlyArray<unknown>): ShapeModel {
  let shape: ShapeModel = { fields: new Map(), sampleCount: 0 };
  for (const sample of samples) {
    if (isPlainObject(sample)) shape = mergeObjectInto(shape, sample);
  }
  return shape;
}

/** True when the field's distinct values look like a closed enum of strings. */
export function isStringEnum(field: FieldModel): boolean {
  if (!field.enumCandidates || field.enumCandidates.size === 0) return false;
  if (field.kinds.has("number") || field.kinds.has("boolean")) return false;
  if (!field.kinds.has("string")) return false;
  return [...field.enumCandidates].every((v) => typeof v === "string");
}

export function enumValues(field: FieldModel): string[] {
  if (!field.enumCandidates) return [];
  return [...field.enumCandidates].map(String).sort();
}
