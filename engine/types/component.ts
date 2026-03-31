/**
 * Component identification, design tokens, page topology, and behavior models.
 *
 * These types are produced by the *analysis* phase that sits between raw
 * extraction (`extraction.ts`) and code generation. They describe the
 * component tree, design-token system, scroll topology, and interaction
 * behaviors needed to faithfully reconstruct the target site.
 */

import type {
  AnimationSpec,
  BreakpointSpec,
  ColorToken,
  ElementSpec,
  FontSpec,
  LibraryInfo,
  SectionSpec,
  SpacingToken,
} from './extraction';

// ---------------------------------------------------------------------------
// Component tree
// ---------------------------------------------------------------------------

export interface ComponentTree {
  root: ComponentNode;
  /** Components reused across multiple sections. */
  sharedComponents: SharedComponent[];
}

export interface ComponentNode {
  id: string;
  /** PascalCase component name. */
  name: string;
  /** Target output file path relative to project root. */
  filePath: string;
  section?: SectionSpec;
  spec: ComponentSpec;
  children: ComponentNode[];
  /** IDs of other `ComponentNode`s this component depends on. */
  dependencies: string[];
}

export interface ComponentSpec {
  name: string;
  description: string;
  /** Whether the component requires a `"use client"` directive. */
  isClient: boolean;
  props: PropSpec[];
  elements: ElementSpec[];
  animations: AnimationSpec[];
  responsiveBreakpoints: BreakpointSpec[];
  interactionModel: string;
  imports: ImportSpec[];
  /** Code produced by the generation phase. */
  generatedCode?: string;
  /** Path to a human-readable spec doc, e.g. `docs/research/components/<name>.spec.md`. */
  specFilePath?: string;
}

export interface PropSpec {
  name: string;
  /** TypeScript type expression (e.g. `string`, `boolean`, `() => void`). */
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ImportSpec {
  module: string;
  namedImports?: string[];
  defaultImport?: string;
}

export interface SharedComponent {
  id: string;
  name: string;
  /** Section IDs where this component appears. */
  usedIn: string[];
  spec: ComponentSpec;
}

// ---------------------------------------------------------------------------
// Design tokens (analyzed from raw extraction)
// ---------------------------------------------------------------------------

export interface GradientStop {
  color: string;
  position?: string;
}

export type GradientType = 'linear' | 'radial' | 'conic';

export interface GradientToken {
  /** Full CSS gradient value. */
  value: string;
  type: GradientType;
  stops: GradientStop[];
  /** Angle or direction for linear gradients (e.g. `"135deg"`, `"to right"`). */
  angle?: string;
  /** Shape descriptor for radial gradients (e.g. `"ellipse at center"`). */
  shape?: string;
  /** Auto-generated CSS custom-property name, e.g. `--gradient-hero`. */
  cssVariable?: string;
}

export interface DesignTokens {
  colors: {
    primary: ColorToken;
    secondary?: ColorToken;
    background: ColorToken;
    foreground: ColorToken;
    muted: ColorToken;
    accent?: ColorToken;
    border: ColorToken;
    /** Every unique color discovered during extraction. */
    all: ColorToken[];
  };
  typography: TypographyScale;
  spacing: SpacingScale;
  borderRadius: RadiusScale;
  shadows: ShadowToken[];
  gradients: GradientToken[];
  fonts: FontSpec[];
  /** Sorted list of detected breakpoint widths (px). */
  breakpoints: number[];
  /** Ready-to-write CSS custom-property map for `globals.css`. */
  cssVariables: Record<string, string>;
}

export interface TypographyScale {
  fontFamilies: {
    sans: string;
    mono: string;
    serif?: string;
  };
  sizes: {
    name: string;
    value: string;
    lineHeight: string;
    usage: string[];
  }[];
  weights: number[];
}

export interface SpacingScale {
  /** De-duplicated, ascending list of spacing values in pixels. */
  values: number[];
  /** Detected base unit — typically 4 or 8. */
  baseUnit: number;
}

export interface RadiusScale {
  values: {
    name: string;
    value: string;
    frequency: number;
  }[];
}

export interface ShadowToken {
  name: string;
  /** Full CSS `box-shadow` value. */
  value: string;
  frequency: number;
}

// ---------------------------------------------------------------------------
// Page topology
// ---------------------------------------------------------------------------

export type TopologySectionBackground = 'light' | 'dark' | 'image' | 'video' | 'gradient';
export type TopologyTransitionType = 'notch' | 'fade' | 'slide' | 'none';

export interface TopologyMap {
  sections: TopologySection[];
  overlays: TopologyOverlay[];
  /** CSS selector of a custom scroll container, or `'window'` for the default. */
  scrollContainer: 'window' | string;
  totalHeight: number;
  hasScrollSnap: boolean;
  hasSmoothScroll: boolean;
  smoothScrollLibrary?: string;
}

export interface TopologySection {
  id: string;
  name: string;
  order: number;
  /** Distance from the top of the document in pixels. */
  top: number;
  height: number;
  background: TopologySectionBackground;
  transition?: {
    type: TopologyTransitionType;
    direction: 'in' | 'out';
  };
}

export type TopologyOverlayType = 'header' | 'footer' | 'sidebar' | 'modal' | 'toast' | 'fab';

export interface TopologyOverlay {
  id: string;
  name: string;
  type: TopologyOverlayType;
  position: 'fixed' | 'sticky';
  zIndex: number;
}

// ---------------------------------------------------------------------------
// Behavior model
// ---------------------------------------------------------------------------

export type GlobalScrollBehavior = 'native' | 'lenis' | 'locomotive' | 'custom';

export interface BehaviorModel {
  sectionBehaviors: Map<string, SectionBehavior>;
  requiredLibraries: LibraryRequirement[];
  globalScrollBehavior: GlobalScrollBehavior;
}

export interface SectionBehavior {
  sectionId: string;
  interactionModel: string;
  animations: AnimationSpec[];
  scrollTriggers: ScrollTrigger[];
  clickHandlers: ClickHandler[];
  hoverEffects: HoverEffect[];
}

export interface ScrollTrigger {
  elementSelector: string;
  /** Distance in pixels from the top of the document. */
  triggerPosition: number;
  action: 'animate' | 'class-toggle' | 'style-change';
  details: Record<string, unknown>;
}

export type ClickAction =
  | 'tab-switch'
  | 'modal-open'
  | 'accordion-toggle'
  | 'navigation'
  | 'custom';

export interface ClickHandler {
  elementSelector: string;
  action: ClickAction;
  targetSelector?: string;
  details: Record<string, unknown>;
}

export interface HoverEffect {
  elementSelector: string;
  styleChanges: Record<string, { from: string; to: string }>;
  /** CSS `transition` shorthand. */
  transition: string;
}

export interface LibraryRequirement {
  name: string;
  npmPackage: string;
  version?: string;
  /** Human-readable explanation of why this library is needed. */
  reason: string;
}
