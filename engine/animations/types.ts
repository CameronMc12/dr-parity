export type AnimationLibrary =
  | 'gsap'
  | 'scrolltrigger'
  | 'lenis'
  | 'intersection-observer'
  | 'unknown';

export type ArgKind = 'literal' | 'opaque';

export interface AnimationArg {
  kind: ArgKind;
  value: unknown;
  rawText: string;
}

export interface AnimationCallSource {
  file: string;
  line: number;
}

export interface AnimationCall {
  library: AnimationLibrary;
  method: string;
  source: AnimationCallSource;
  args: AnimationArg[];
  editable: boolean;
}

export interface UneditableEntry {
  library: AnimationLibrary;
  method: string;
  source: AnimationCallSource;
  rawText: string;
  reason: UneditableReason;
}

export type UneditableReason =
  | 'opaque-callback'
  | 'runtime-variable'
  | 'computed-member'
  | 'spread-argument'
  | 'no-config-object'
  | 'mixed-args';

export interface EditableModule {
  id: string;
  filename: string;
  slug: string;
  call: AnimationCall;
  exportName: string;
  config: Record<string, unknown> | unknown[];
}

export interface AnimationsSummary {
  totalCalls: number;
  editable: number;
  uneditable: number;
  filesScanned: number;
  filesFailed: number;
  byLibrary: Record<AnimationLibrary, { editable: number; uneditable: number; total: number }>;
}

export interface ExtractResult {
  calls: AnimationCall[];
  uneditable: UneditableEntry[];
  modules: EditableModule[];
  summary: AnimationsSummary;
}

export interface PluginRegistration {
  name: string;
  file: string;
  line: number;
}
