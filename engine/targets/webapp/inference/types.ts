/**
 * Phase 3 inference types. Consumed by emit-stateful to produce React TSX
 * with working useState wiring for overlays (modals/dropdowns/popovers).
 */

export type ToggleKind =
  | 'modal'
  | 'dropdown'
  | 'popover'
  | 'drawer'
  | 'toast'
  | 'unknown';

export type DismissStrategy =
  | 'escape'
  | 'click-outside'
  | 'explicit-close-button'
  | 'unknown';

export interface SerializedElement {
  tag: string;
  attributes: Record<string, string>;
  innerHTML: string;
  outerHTML: string;
}

export interface StateToggle {
  toggleStateId: string;
  triggerSelector: string;
  triggerLabel: string;
  dismissStrategy: DismissStrategy;
  closeButtonSelector?: string;
  kind: ToggleKind;
  appearedRoot: SerializedElement;
  appearedSelectorPath: string;
}

export interface StateGroup {
  baseStateId: string;
  routePath: string;
  toggles: StateToggle[];
}

export interface RouteGroup {
  routePath: string;
  baseStateGroup: StateGroup;
  alternateBases?: StateGroup[];
}

export interface InferenceResult {
  routes: RouteGroup[];
  unmatchedStates: string[];
  warnings: string[];
}

export type DomDiffClassification =
  | 'overlay'
  | 'inline-change'
  | 'route-change'
  | 'mixed';

export interface DomDiff {
  added: SerializedElement[];
  removed: SerializedElement[];
  modifiedTextNodes: { selector: string; before: string; after: string }[];
  classification: DomDiffClassification;
}
