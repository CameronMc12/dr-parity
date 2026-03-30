/**
 * Core extraction data model.
 *
 * These types represent everything captured from a target website during the
 * inspection / reverse-engineering phase. Every other engine module depends on
 * this contract, so changes here must be coordinated across the entire pipeline.
 */

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Page-level extraction output
// ---------------------------------------------------------------------------

/** The complete extraction output for a single page. */
export interface PageData {
  url: string;
  title: string;
  description: string;
  viewport: Viewport;
  fonts: FontSpec[];
  colors: ColorToken[];
  spacing: SpacingToken[];
  sections: SectionSpec[];
  globalBehaviors: GlobalBehavior[];
  assets: AssetManifest;
  techStack: TechStackAnalysis;
  /** Extracted CSS stylesheets with rules, variables, keyframes, and media queries. */
  stylesheets?: StylesheetExtractionResult;
  /** ISO-8601 timestamp of when extraction ran. */
  extractedAt: string;
}

// ---------------------------------------------------------------------------
// Stylesheet extraction
// ---------------------------------------------------------------------------

export interface StylesheetData {
  /** URL of the stylesheet, or null for inline <style> elements. */
  url: string | null;
  rules: CSSRuleData[];
  mediaQueries: MediaQueryData[];
  keyframes: KeyframeData[];
  cssVariables: CSSVariableData[];
}

export interface CSSRuleData {
  selector: string;
  properties: Record<string, string>;
}

export interface MediaQueryData {
  query: string;
  rules: CSSRuleData[];
}

export interface KeyframeData {
  name: string;
  frames: { offset: string; properties: Record<string, string> }[];
}

export interface CSSVariableData {
  name: string;
  value: string;
  /** Scope selector, e.g. `:root`, `.dark`. */
  scope: string;
}

export interface StylesheetExtractionResult {
  stylesheets: StylesheetData[];
  totalRules: number;
  totalKeyframes: number;
  totalMediaQueries: number;
  totalVariables: number;
}

// ---------------------------------------------------------------------------
// Section & element tree
// ---------------------------------------------------------------------------

export type SectionPosition = 'flow' | 'sticky' | 'fixed' | 'absolute';

export type InteractionModel =
  | 'static'
  | 'scroll-driven'
  | 'click-driven'
  | 'time-driven'
  | 'hover-driven'
  | 'hybrid';

export interface SectionSpec {
  id: string;
  name: string;
  order: number;
  boundingRect: Rect;
  screenshots: {
    desktop: string;
    tablet?: string;
    mobile?: string;
  };
  elements: ElementSpec[];
  animations: AnimationSpec[];
  interactionModel: InteractionModel;
  responsiveBreakpoints: BreakpointSpec[];
  zIndex: number;
  position: SectionPosition;
  backgroundColor: string;
  className: string;
  /** Raw HTML structure for builders. */
  outerHTML?: string;
}

export interface ElementSpec {
  tag: string;
  id?: string;
  classes: string[];
  /** All non-default computed styles keyed by CSS property name. */
  computedStyles: Record<string, string>;
  textContent?: string;
  /** Raw inner HTML — primarily useful for inline SVG elements. */
  innerHTML?: string;
  attributes: Record<string, string>;
  children: ElementSpec[];
  states: StateSpec[];
  animations: AnimationSpec[];
  boundingRect: Rect;
  isVisible: boolean;
  media?: MediaSpec;
}

export interface StateSpec {
  trigger: 'hover' | 'active' | 'focus' | 'checked' | 'disabled' | 'scroll-past';
  styleChanges: Record<string, { from: string; to: string }>;
  /** Raw CSS `transition` shorthand value, if present. */
  transition?: string;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type MediaType = 'image' | 'video' | 'svg' | 'canvas' | 'iframe';

export interface MediaSpec {
  type: MediaType;
  src?: string;
  /** Local file path after the asset has been downloaded. */
  localPath?: string;
  alt?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit?: string;
  objectPosition?: string;
  /** For layered / composited visuals. */
  layerIndex?: number;
  isOverlay?: boolean;
}

// ---------------------------------------------------------------------------
// Animations — the core differentiator of this engine
// ---------------------------------------------------------------------------

export type AnimationType =
  | 'css-transition'
  | 'css-animation'
  | 'css-scroll-timeline'
  | 'gsap'
  | 'lenis'
  | 'locomotive-scroll'
  | 'intersection-observer'
  | 'scroll-listener'
  | 'raf-driven'
  | 'framer-motion'
  | 'webgl'
  | 'lottie'
  | 'unknown';

export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';

export interface AnimationSpec {
  id: string;
  type: AnimationType;
  trigger: AnimationTrigger;
  properties: AnimatedProperty[];
  /** Duration in milliseconds. */
  duration: number;
  easing: string;
  /** Delay in milliseconds. */
  delay: number;
  iterations: number | 'infinite';
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  keyframes?: AnimationKeyframe[];
  library?: LibraryInfo;
  /** CSS selector that targets the animated element. */
  elementSelector: string;
  /** Human-readable description, e.g. "Fades in from below when scrolled into view". */
  humanDescription: string;
  /** Implementation guidance for the code-generation phase. */
  implementationNotes: string;
  /** Optional pre-generated code snippet to recreate this animation. */
  codeSnippet?: string;
}

export type AnimationTriggerType =
  | 'scroll-position'
  | 'intersection'
  | 'hover'
  | 'click'
  | 'load'
  | 'time'
  | 'scroll-progress'
  | 'resize';

export interface AnimationTrigger {
  type: AnimationTriggerType;
  /** IntersectionObserver threshold (0-1). */
  threshold?: number;
  /** IntersectionObserver rootMargin string. */
  rootMargin?: string;
  /** Scroll position (px from top) where animation starts. */
  scrollStart?: number;
  /** Scroll position (px from top) where animation ends. */
  scrollEnd?: number;
  /** CSS selector of the scroll container; defaults to window. */
  scrollContainer?: string;
  /** Selector for the trigger element when it differs from the animated element. */
  targetElement?: string;
  /** Delay in ms after the trigger fires before the animation begins. */
  delay?: number;
}

export interface AnimatedProperty {
  /** CSS property name, e.g. `opacity`, `transform`. */
  property: string;
  from: string;
  to: string;
  unit?: string;
}

export interface AnimationKeyframe {
  /** Offset between 0 and 1 inclusive. */
  offset: number;
  styles: Record<string, string>;
  easing?: string;
}

// ---------------------------------------------------------------------------
// Third-party library detection
// ---------------------------------------------------------------------------

export interface LibraryInfo {
  name: string;
  version?: string;
  detected: boolean;
  cdnUrl?: string;
  npmPackage?: string;
}

// ---------------------------------------------------------------------------
// Font system
// ---------------------------------------------------------------------------

export type FontSource = 'google' | 'self-hosted' | 'system' | 'typekit' | 'adobe' | 'unknown';
export type FontStyle = 'normal' | 'italic' | 'oblique';
export type FontFileFormat = 'woff2' | 'woff' | 'ttf' | 'otf' | 'eot';

export interface FontSpec {
  family: string;
  weights: number[];
  styles: FontStyle[];
  source: FontSource;
  files: FontFile[];
  fallbacks: string[];
  /** Element selectors that reference this font. */
  usedIn: string[];
  isVariable: boolean;
  variableAxes?: Record<string, { min: number; max: number; default: number }>;
}

export interface FontFile {
  weight: number;
  style: string;
  url: string;
  format: FontFileFormat;
  /** Local path after download. */
  localPath?: string;
  unicodeRange?: string;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

export interface ColorToken {
  /** Auto-generated semantic name for the token. */
  name: string;
  /** Color value in rgb/rgba/hex notation. */
  value: string;
  /** Where it appears: `background`, `text`, `border`, etc. */
  usage: string[];
  /** How many elements reference this color. */
  frequency: number;
  /** Mapped CSS custom-property name, e.g. `--color-primary`. */
  cssVariable?: string;
}

export interface SpacingToken {
  /** Value in pixels. */
  value: number;
  frequency: number;
  /** Categories: `padding`, `margin`, `gap`, etc. */
  usage: string[];
}

// ---------------------------------------------------------------------------
// Responsive breakpoints
// ---------------------------------------------------------------------------

export interface BreakpointSpec {
  width: number;
  changes: BreakpointChange[];
}

export interface BreakpointChange {
  elementSelector: string;
  property: string;
  desktopValue: string;
  breakpointValue: string;
}

// ---------------------------------------------------------------------------
// Global behaviors
// ---------------------------------------------------------------------------

export type GlobalBehaviorType =
  | 'smooth-scroll'
  | 'scroll-snap'
  | 'custom-cursor'
  | 'dark-mode'
  | 'preloader'
  | 'scroll-hijack'
  | 'other';

export interface GlobalBehavior {
  type: GlobalBehaviorType;
  library?: LibraryInfo;
  config?: Record<string, unknown>;
  description: string;
}

// ---------------------------------------------------------------------------
// Asset manifest
// ---------------------------------------------------------------------------

export interface AssetManifest {
  images: AssetEntry[];
  videos: AssetEntry[];
  svgs: SvgEntry[];
  fonts: FontFile[];
  favicons: AssetEntry[];
  ogImages: AssetEntry[];
  other: AssetEntry[];
}

export interface AssetEntry {
  originalUrl: string;
  localPath: string;
  filename: string;
  mimeType?: string;
  /** File size in bytes. */
  size?: number;
  dimensions?: { width: number; height: number };
}

export interface SvgEntry extends AssetEntry {
  viewBox?: string;
  /** Raw SVG markup. */
  content: string;
  /** PascalCase name suitable for a React component. */
  componentName?: string;
}

// ---------------------------------------------------------------------------
// Tech stack detection
// ---------------------------------------------------------------------------

export type DetectedFramework =
  | 'react'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'astro'
  | 'next'
  | 'nuxt'
  | 'gatsby'
  | 'unknown';

export type DetectedCssApproach =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'emotion'
  | 'vanilla'
  | 'sass'
  | 'unknown';

export interface TechStackAnalysis {
  framework?: DetectedFramework;
  cssApproach?: DetectedCssApproach;
  animationLibraries: LibraryInfo[];
  scrollLibrary?: LibraryInfo;
  bundler?: string;
  isSSR: boolean;
  hasServiceWorker: boolean;
}
