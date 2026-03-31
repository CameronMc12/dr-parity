/**
 * Animation Detector — Dr Parity's core differentiator.
 *
 * Detects and captures ALL animations on a page using a three-layer strategy:
 *   1. Static Analysis   — parse stylesheets & DOM for declared animations
 *   2. Runtime Monitoring — inject shims before page scripts to intercept observers,
 *                           Web Animations API calls, and scroll listeners
 *   3. Active Probing     — scroll & hover to trigger latent animations, then diff
 *
 * Usage:
 *   await injectAnimationMonitors(page);   // call BEFORE page.goto()
 *   await page.goto(url);
 *   const result = await detectAnimations(page, options);
 */

import type { Page } from "playwright";
import type {
  AnimationSpec,
  AnimationType,
  AnimationTrigger,
  AnimatedProperty,
  AnimationKeyframe,
  LibraryInfo,
  AnimationDirection,
  AnimationFillMode,
  StaggerPattern,
} from "../../types/extraction";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AnimationDetectionResult {
  animations: AnimationSpec[];
  libraries: LibraryInfo[];
  globalScrollBehavior: "native" | "lenis" | "locomotive" | "custom";
  /** Detected stagger patterns among sibling elements. */
  staggerPatterns: StaggerPattern[];
  totalDetected: number;
  detectionDuration: number;
}

export interface DetectionOptions {
  /** Run the scroll probe to trigger scroll-driven animations. Default `true`. */
  scrollProbe?: boolean;
  /** Run the hover probe to trigger CSS transitions. Default `true`. */
  hoverProbe?: boolean;
  /** Pixels between each scroll stop during the scroll probe. Default `100`. */
  scrollIncrements?: number;
  /** Cap the number of returned animations to avoid overwhelming output. Default `200`. */
  maxAnimations?: number;
  /** Milliseconds to wait after page load for initial animations to settle. Default `2000`. */
  settleTimeout?: number;
}

// ---------------------------------------------------------------------------
// Internal helper types (not exported)
// ---------------------------------------------------------------------------

interface ObserverRecord {
  selector: string;
  label: string;
  threshold: number | undefined;
  rootMargin: string | undefined;
  timestamp: number;
}

interface WebAnimationRecord {
  selector: string;
  keyframes: Record<string, string>[] | Keyframe[];
  options: KeyframeAnimationOptions;
  timestamp: number;
}

interface ScrollListenerRecord {
  target: string;
  timestamp: number;
}

interface ScrollTriggerRecord {
  trigger: string | null;
  pin?: string | boolean;
  scrub?: number | boolean;
  start?: string;
  end?: string;
  snap?: number | boolean | Record<string, unknown>;
  markers?: boolean;
  toggleClass?: string;
  toggleActions?: string;
  onEnter: boolean;
  onLeave: boolean;
  onUpdate: boolean;
  onToggle: boolean;
  onEnterBack: boolean;
  onLeaveBack: boolean;
  animatedProperties?: string[];
  timestamp: number;
}

interface IOEffectRecord {
  selector: string;
  classesAdded: string[];
  classesRemoved: string[];
  styleChanged: boolean;
  newStyle: string;
  threshold?: number | number[];
  rootMargin?: string;
}

interface ParsedKeyframesRule {
  name: string;
  keyframes: AnimationKeyframe[];
}

interface CssTransitionInfo {
  selector: string;
  property: string;
  duration: string;
  timingFunction: string;
  delay: string;
}

interface CssAnimationInfo {
  selector: string;
  animationName: string;
  duration: string;
  timingFunction: string;
  delay: string;
  iterationCount: string;
  direction: string;
  fillMode: string;
}

interface StyleSnapshot {
  selector: string;
  styles: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACKED_STYLE_PROPERTIES = [
  "opacity",
  "transform",
  "visibility",
  "clip-path",
  "filter",
  "background-color",
  "color",
  "border-color",
  "box-shadow",
  "width",
  "height",
  "max-height",
  "top",
  "left",
  "right",
  "bottom",
  "margin-top",
  "margin-left",
  "padding",
  "font-size",
  "letter-spacing",
  "scale",
] as const;

const MAX_SELECTOR_ELEMENTS = 50;
const SCROLL_PAUSE_MS = 60;
const HOVER_PAUSE_MS = 150;

// ---------------------------------------------------------------------------
// 1. Runtime Monitoring Script — inject BEFORE page.goto()
// ---------------------------------------------------------------------------

/**
 * Injects monitoring shims into the page context via `addInitScript`.
 * **Must** be called before `page.goto()` so the shims run before the page's
 * own JavaScript.
 */
export async function injectAnimationMonitors(page: Page): Promise<void> {
  await page.addInitScript(runtimeMonitoringScript);
}

const runtimeMonitoringScript = `(() => {
  "use strict";

  // ----- Selector helper -----
  function __drpSelector(el) {
    if (!el || el === document.body) return "body";
    if (el.id) return "#" + CSS.escape(el.id);
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur.nodeType === 1) {
      let seg = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === "string") {
        const cls = cur.className
          .trim()
          .split(/\\s+/)
          .filter(c => c && !c.startsWith("__"))
          .slice(0, 2)
          .join(".");
        if (cls) seg += "." + cls;
      }
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  // ----- Storage -----
  const __drp_observers  = [];
  const __drp_webAnims   = [];
  const __drp_scrollLsns = [];

  // ----- IntersectionObserver shim -----
  const OrigIO = window.IntersectionObserver;
  window.IntersectionObserver = function(callback, options) {
    const wrapped = function(entries, obs) {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e.isIntersecting) {
          try {
            __drp_observers.push({
              label: e.target.tagName + "." + (e.target.className?.split?.(" ")?.[0] || ""),
              selector: __drpSelector(e.target),
              threshold: options?.threshold,
              rootMargin: options?.rootMargin,
              timestamp: Date.now(),
            });
          } catch (_) { /* never break the page */ }
        }
      }
      return callback(entries, obs);
    };
    return new OrigIO(wrapped, options);
  };
  window.IntersectionObserver.prototype = OrigIO.prototype;
  Object.defineProperty(window.IntersectionObserver, "name", { value: "IntersectionObserver" });

  // ----- Element.prototype.animate shim -----
  const origAnimate = Element.prototype.animate;
  Element.prototype.animate = function(keyframes, options) {
    try {
      __drp_webAnims.push({
        selector: __drpSelector(this),
        keyframes: JSON.parse(JSON.stringify(keyframes)),
        options: typeof options === "number"
          ? { duration: options }
          : JSON.parse(JSON.stringify(options || {})),
        timestamp: Date.now(),
      });
    } catch (_) { /* never break the page */ }
    return origAnimate.call(this, keyframes, options);
  };

  // ----- Scroll listener tracker -----
  const origAEL = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, opts) {
    if (type === "scroll") {
      try {
        __drp_scrollLsns.push({
          target: this === window ? "window" : this === document ? "document" : (this.tagName || "unknown"),
          timestamp: Date.now(),
        });
      } catch (_) { /* never break the page */ }
    }
    return origAEL.call(this, type, listener, opts);
  };

  // ----- GSAP ScrollTrigger interception (Item 1.3) -----
  var __drp_scrollTriggers = [];

  function __drpWrapScrollTrigger() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;
    try {
      var OrigCreate = ScrollTrigger.create.bind(ScrollTrigger);
      ScrollTrigger.create = function(vars) {
        try {
          __drp_scrollTriggers.push({
            trigger: vars.trigger ? __drpSelector(typeof vars.trigger === "string" ? document.querySelector(vars.trigger) : vars.trigger) : null,
            pin: vars.pin,
            scrub: vars.scrub,
            start: vars.start,
            end: vars.end,
            snap: vars.snap,
            markers: vars.markers,
            toggleClass: vars.toggleClass,
            toggleActions: vars.toggleActions,
            onEnter: !!vars.onEnter,
            onLeave: !!vars.onLeave,
            onUpdate: !!vars.onUpdate,
            onToggle: !!vars.onToggle,
            onEnterBack: !!vars.onEnterBack,
            onLeaveBack: !!vars.onLeaveBack,
            timestamp: Date.now()
          });
        } catch(e) {}
        return OrigCreate(vars);
      };
    } catch(e) {}
  }

  function __drpWrapGsapTweens() {
    if (typeof gsap === "undefined") return;
    try {
      var methods = ["to", "from", "fromTo"];
      for (var mi = 0; mi < methods.length; mi++) {
        (function(method) {
          var orig = gsap[method].bind(gsap);
          gsap[method] = function() {
            var args = Array.prototype.slice.call(arguments);
            var vars = method === "fromTo" ? args[2] : args[1];
            if (vars && vars.scrollTrigger) {
              try {
                var st = vars.scrollTrigger;
                var animProps = Object.keys(vars).filter(function(k) {
                  return k !== "scrollTrigger" && k !== "duration" && k !== "ease" && k !== "delay";
                });
                __drp_scrollTriggers.push({
                  trigger: st.trigger ? __drpSelector(typeof st.trigger === "string" ? document.querySelector(st.trigger) : st.trigger) : null,
                  pin: st.pin,
                  scrub: st.scrub,
                  start: st.start,
                  end: st.end,
                  snap: st.snap,
                  markers: st.markers,
                  toggleClass: st.toggleClass,
                  toggleActions: st.toggleActions,
                  onEnter: !!st.onEnter,
                  onLeave: !!st.onLeave,
                  onUpdate: !!st.onUpdate,
                  onToggle: !!st.onToggle,
                  onEnterBack: !!st.onEnterBack,
                  onLeaveBack: !!st.onLeaveBack,
                  animatedProperties: animProps,
                  timestamp: Date.now()
                });
              } catch(e) {}
            }
            return orig.apply(gsap, args);
          };
        })(methods[mi]);
      }
    } catch(e) {}
  }

  __drpWrapScrollTrigger();
  __drpWrapGsapTweens();
  setTimeout(function() { __drpWrapScrollTrigger(); __drpWrapGsapTweens(); }, 2000);

  // ----- Enhanced IntersectionObserver effect capture (Item 1.4) -----
  var __drp_ioEffects = [];

  // Patch the existing IO wrapper's callback to capture class/style changes
  // We do this by wrapping the user's callback in a MutationObserver-based diff
  var __drp_ioTargetSnapshots = new WeakMap();

  // Observe intersecting elements for class/style mutations after callback fires
  var __drp_ioMutObs = new MutationObserver(function(mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var mut = mutations[m];
      var el = mut.target;
      var sel = __drpSelector(el);
      var snapshot = __drp_ioTargetSnapshots.get(el);
      if (!snapshot) continue;

      var currentClasses = Array.from(el.classList);
      var added = currentClasses.filter(function(c) { return snapshot.classes.indexOf(c) === -1; });
      var removed = snapshot.classes.filter(function(c) { return currentClasses.indexOf(c) === -1; });
      var currentStyle = el.getAttribute("style") || "";
      var styleChanged = snapshot.style !== currentStyle;

      if (added.length > 0 || removed.length > 0 || styleChanged) {
        __drp_ioEffects.push({
          selector: sel,
          classesAdded: added,
          classesRemoved: removed,
          styleChanged: styleChanged,
          newStyle: currentStyle,
          threshold: snapshot.threshold,
          rootMargin: snapshot.rootMargin
        });
        // Unregister after first capture to avoid noise
        __drp_ioMutObs.unobserve(el);
        __drp_ioTargetSnapshots.delete(el);
      }
    }
  });

  // Enhance the already-shimmed IO wrapper to snapshot elements before callback
  var _PrevIO = window.IntersectionObserver;
  window.IntersectionObserver = function(callback, options) {
    var enhancedCallback = function(entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          var el = entry.target;
          try {
            // Snapshot current state before callback fires
            __drp_ioTargetSnapshots.set(el, {
              classes: Array.from(el.classList),
              style: el.getAttribute("style") || "",
              threshold: options ? options.threshold : undefined,
              rootMargin: options ? options.rootMargin : undefined
            });
            // Observe for mutations caused by the callback
            __drp_ioMutObs.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
          } catch(e) {}
        }
      }
      return callback(entries, obs);
    };
    return new _PrevIO(enhancedCallback, options);
  };
  window.IntersectionObserver.prototype = _PrevIO.prototype;
  Object.defineProperty(window.IntersectionObserver, "name", { value: "IntersectionObserver" });

  // ----- Public accessors -----
  window.__drp_getObserverData   = () => JSON.stringify(__drp_observers);
  window.__drp_getWebAnimations  = () => JSON.stringify(__drp_webAnims);
  window.__drp_getScrollListeners = () => JSON.stringify(__drp_scrollLsns);
  window.__drp_getScrollTriggers = () => JSON.stringify(__drp_scrollTriggers);
  window.__drp_getIOEffects      = () => JSON.stringify(__drp_ioEffects);
})();`;

// ---------------------------------------------------------------------------
// 2. Main detection entry point
// ---------------------------------------------------------------------------

export async function detectAnimations(
  page: Page,
  options?: DetectionOptions,
): Promise<AnimationDetectionResult> {
  const start = Date.now();
  const opts: Required<DetectionOptions> = {
    scrollProbe: options?.scrollProbe ?? true,
    hoverProbe: options?.hoverProbe ?? true,
    scrollIncrements: options?.scrollIncrements ?? 100,
    maxAnimations: options?.maxAnimations ?? 200,
    settleTimeout: options?.settleTimeout ?? 2000,
  };

  // Let initial animations settle
  await page.waitForTimeout(opts.settleTimeout);

  // --- Layer 1: Static analysis ---
  const [keyframesRules, cssTransitions, cssAnimations, libraries, scrollBehavior] =
    await Promise.all([
      extractKeyframes(page),
      extractCssTransitions(page),
      extractCssAnimations(page),
      detectLibraries(page),
      detectScrollBehavior(page),
    ]);

  // --- Layer 2: Collect runtime monitoring data ---
  const [observerData, webAnimData, scrollListenerData, scrollTriggerData, ioEffects] =
    await collectRuntimeData(page);

  // --- Layer 3: Active probing ---
  const scrollAnimations = opts.scrollProbe
    ? await scrollProbe(page, observerData, opts.scrollIncrements)
    : [];

  const hoverAnimations = opts.hoverProbe
    ? await hoverProbe(page, cssTransitions)
    : [];

  // --- Stagger detection ---
  const staggerPatterns = await detectStaggerPatterns(page);

  // --- Assemble results ---
  const keyframeMap = buildKeyframeMap(keyframesRules);

  const ioSpecs = buildIntersectionObserverSpecs(observerData, scrollAnimations);
  mergeIOEffectsIntoSpecs(ioSpecs, ioEffects);

  const allAnimations: AnimationSpec[] = [
    ...buildCssTransitionSpecs(cssTransitions),
    ...buildCssAnimationSpecs(cssAnimations, keyframeMap),
    ...ioSpecs,
    ...buildWebAnimationSpecs(webAnimData),
    ...buildScrollListenerSpecs(scrollListenerData),
    ...buildHoverSpecs(hoverAnimations),
    ...buildLibrarySpecificSpecs(libraries),
    ...buildScrollTriggerSpecs(scrollTriggerData),
  ];

  // Deduplicate by elementSelector + type
  const deduped = deduplicateAnimations(allAnimations);
  const capped = deduped.slice(0, opts.maxAnimations);

  return {
    animations: capped,
    libraries,
    globalScrollBehavior: scrollBehavior,
    staggerPatterns,
    totalDetected: deduped.length,
    detectionDuration: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Layer 1: Static Analysis helpers
// ---------------------------------------------------------------------------

async function extractKeyframes(page: Page): Promise<ParsedKeyframesRule[]> {
  return page.evaluate(() => {
    const rules: Array<{ name: string; keyframes: Array<{ offset: number; styles: Record<string, string> }> }> = [];
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSKeyframesRule) {
              const kfs: Array<{ offset: number; styles: Record<string, string> }> = [];
              for (const kf of Array.from(rule.cssRules)) {
                if (kf instanceof CSSKeyframeRule) {
                  const styles: Record<string, string> = {};
                  for (let i = 0; i < kf.style.length; i++) {
                    const prop = kf.style[i];
                    styles[prop] = kf.style.getPropertyValue(prop);
                  }
                  const offsets = kf.keyText.split(",").map(t => {
                    const trimmed = t.trim();
                    if (trimmed === "from") return 0;
                    if (trimmed === "to") return 1;
                    return parseFloat(trimmed) / 100;
                  });
                  for (const offset of offsets) {
                    kfs.push({ offset, styles });
                  }
                }
              }
              kfs.sort((a, b) => a.offset - b.offset);
              rules.push({ name: rule.name, keyframes: kfs });
            }
          }
        } catch {
          // Cross-origin stylesheet — skip
        }
      }
    } catch {
      // styleSheets access may fail
    }
    return rules;
  });
}

async function extractCssTransitions(page: Page): Promise<CssTransitionInfo[]> {
  return page.evaluate(() => {
    const results: Array<{
      selector: string;
      property: string;
      duration: string;
      timingFunction: string;
      delay: string;
    }> = [];
    const seen = new Set<string>();

    const elements = document.querySelectorAll("*");
    const limit = Math.min(elements.length, 2000);

    for (let i = 0; i < limit; i++) {
      const el = elements[i];
      const computed = getComputedStyle(el);
      const prop = computed.transitionProperty;
      const dur = computed.transitionDuration;

      if (!prop || prop === "none" || !dur || dur === "0s") continue;

      // Build selector
      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = "#" + CSS.escape(el.id);
      } else if (el.className && typeof el.className === "string") {
        const cls = el.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (cls) selector += "." + cls;
      }

      const key = selector + "|" + prop;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        selector,
        property: prop,
        duration: dur,
        timingFunction: computed.transitionTimingFunction,
        delay: computed.transitionDelay,
      });
    }
    return results;
  });
}

async function extractCssAnimations(page: Page): Promise<CssAnimationInfo[]> {
  return page.evaluate(() => {
    const results: Array<{
      selector: string;
      animationName: string;
      duration: string;
      timingFunction: string;
      delay: string;
      iterationCount: string;
      direction: string;
      fillMode: string;
    }> = [];
    const seen = new Set<string>();

    const elements = document.querySelectorAll("*");
    const limit = Math.min(elements.length, 2000);

    for (let i = 0; i < limit; i++) {
      const el = elements[i];
      const computed = getComputedStyle(el);
      const name = computed.animationName;

      if (!name || name === "none") continue;

      let selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = "#" + CSS.escape(el.id);
      } else if (el.className && typeof el.className === "string") {
        const cls = el.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (cls) selector += "." + cls;
      }

      const key = selector + "|" + name;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        selector,
        animationName: name,
        duration: computed.animationDuration,
        timingFunction: computed.animationTimingFunction,
        delay: computed.animationDelay,
        iterationCount: computed.animationIterationCount,
        direction: computed.animationDirection,
        fillMode: computed.animationFillMode,
      });
    }
    return results;
  });
}

// ---------------------------------------------------------------------------
// Layer 1: Library & scroll behavior detection
// ---------------------------------------------------------------------------

async function detectLibraries(page: Page): Promise<LibraryInfo[]> {
  return page.evaluate(() => {
    const libs: Array<{ name: string; version?: string; detected: boolean; npmPackage?: string }> = [];

    // GSAP
    const win = window as unknown as Record<string, unknown>;
    const gsap = win.gsap as Record<string, unknown> | undefined;
    if (gsap) {
      libs.push({
        name: "GSAP",
        version: typeof gsap.version === "string" ? gsap.version : undefined,
        detected: true,
        npmPackage: "gsap",
      });
    }
    if (win.ScrollTrigger) {
      libs.push({ name: "GSAP ScrollTrigger", detected: true, npmPackage: "gsap" });
    }

    // Lenis
    const html = document.documentElement;
    const hasLenis =
      win.lenis ||
      html.classList.contains("lenis") ||
      html.classList.contains("lenis-smooth");
    if (hasLenis) {
      libs.push({ name: "Lenis", detected: true, npmPackage: "lenis" });
    }

    // Locomotive Scroll
    const hasLoco =
      document.querySelector("[data-scroll]") ||
      document.querySelector("[data-scroll-container]") ||
      html.classList.contains("locomotive-scroll");
    if (hasLoco) {
      libs.push({ name: "Locomotive Scroll", detected: true, npmPackage: "locomotive-scroll" });
    }

    // Framer Motion
    const hasFramer =
      document.querySelector("[data-framer-component-type]") ||
      document.querySelector("[data-motion-pop-id]") ||
      document.querySelector("[style*='--framer']");
    if (hasFramer) {
      libs.push({ name: "Framer Motion", detected: true, npmPackage: "framer-motion" });
    }

    // Lottie
    const hasLottie =
      document.querySelector("lottie-player") ||
      document.querySelector("dotlottie-player");
    if (hasLottie) {
      libs.push({ name: "Lottie", detected: true, npmPackage: "lottie-web" });
    }

    // AOS (Animate on Scroll)
    const hasAOS = document.querySelector("[data-aos]");
    if (hasAOS) {
      libs.push({ name: "AOS", detected: true, npmPackage: "aos" });
    }

    // ScrollReveal
    const hasSR = document.querySelector("[data-sr-id]");
    if (hasSR) {
      libs.push({ name: "ScrollReveal", detected: true, npmPackage: "scrollreveal" });
    }

    return libs;
  });
}

async function detectScrollBehavior(
  page: Page,
): Promise<"native" | "lenis" | "locomotive" | "custom"> {
  return page.evaluate(() => {
    const win = window as unknown as Record<string, unknown>;
    const html = document.documentElement;
    if (
      win.lenis ||
      html.classList.contains("lenis") ||
      html.classList.contains("lenis-smooth")
    ) {
      return "lenis" as const;
    }
    if (
      document.querySelector("[data-scroll-container]") ||
      html.classList.contains("locomotive-scroll")
    ) {
      return "locomotive" as const;
    }
    // Check for scroll-behavior: smooth on html/body
    const style = getComputedStyle(html);
    if (style.scrollBehavior === "smooth") {
      return "native" as const;
    }
    // Detect custom scroll hijacking
    if (style.overflow === "hidden" && html.scrollHeight > html.clientHeight) {
      return "custom" as const;
    }
    return "native" as const;
  });
}

// ---------------------------------------------------------------------------
// Layer 2: Collect runtime monitoring data
// ---------------------------------------------------------------------------

async function collectRuntimeData(
  page: Page,
): Promise<[ObserverRecord[], WebAnimationRecord[], ScrollListenerRecord[], ScrollTriggerRecord[], IOEffectRecord[]]> {
  const [rawObservers, rawWebAnims, rawScrollLsns, rawScrollTriggers, rawIOEffects] = await Promise.all([
    page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__drp_getObserverData as (() => string) | undefined;
      return fn ? fn() : "[]";
    }),
    page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__drp_getWebAnimations as (() => string) | undefined;
      return fn ? fn() : "[]";
    }),
    page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__drp_getScrollListeners as (() => string) | undefined;
      return fn ? fn() : "[]";
    }),
    page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__drp_getScrollTriggers as (() => string) | undefined;
      return fn ? fn() : "[]";
    }),
    page.evaluate(() => {
      const fn = (window as unknown as Record<string, unknown>).__drp_getIOEffects as (() => string) | undefined;
      return fn ? fn() : "[]";
    }),
  ]);

  return [
    safeJsonParse<ObserverRecord[]>(rawObservers, []),
    safeJsonParse<WebAnimationRecord[]>(rawWebAnims, []),
    safeJsonParse<ScrollListenerRecord[]>(rawScrollLsns, []),
    safeJsonParse<ScrollTriggerRecord[]>(rawScrollTriggers, []),
    safeJsonParse<IOEffectRecord[]>(rawIOEffects, []),
  ];
}

// ---------------------------------------------------------------------------
// Layer 3: Active probing
// ---------------------------------------------------------------------------

interface ScrollStyleDiff {
  selector: string;
  scrollY: number;
  changes: Array<{ property: string; from: string; to: string }>;
}

async function scrollProbe(
  page: Page,
  observerData: ObserverRecord[],
  increment: number,
): Promise<ScrollStyleDiff[]> {
  // Collect selectors from observer data
  const selectors = uniqueSelectors(observerData.map(o => o.selector));

  if (selectors.length === 0) return [];

  // Capture initial styles
  const initialStyles = await captureElementStyles(page, selectors);
  const diffs: ScrollStyleDiff[] = [];

  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const maxScroll = totalHeight - viewportHeight;

  for (let y = 0; y <= maxScroll; y += increment) {
    await page.evaluate((scrollY: number) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(SCROLL_PAUSE_MS);

    const currentStyles = await captureElementStyles(page, selectors);
    const newDiffs = diffStyles(initialStyles, currentStyles, y);
    diffs.push(...newDiffs);
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  return diffs;
}

interface HoverStyleDiff {
  selector: string;
  changes: Array<{ property: string; from: string; to: string }>;
  transitionDuration: string;
  transitionTimingFunction: string;
}

async function hoverProbe(
  page: Page,
  transitions: CssTransitionInfo[],
): Promise<HoverStyleDiff[]> {
  const selectors = uniqueSelectors(transitions.map(t => t.selector));
  const limited = selectors.slice(0, MAX_SELECTOR_ELEMENTS);
  const results: HoverStyleDiff[] = [];

  for (const selector of limited) {
    try {
      const el = page.locator(selector).first();
      const isVisible = await el.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Capture before-hover styles
      const before = await captureElementStyles(page, [selector]);

      await el.hover({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(HOVER_PAUSE_MS);

      const after = await captureElementStyles(page, [selector]);
      const changes = diffSingleElement(before[0], after[0]);

      if (changes.length > 0) {
        const info = transitions.find(t => t.selector === selector);
        results.push({
          selector,
          changes,
          transitionDuration: info?.duration ?? "0.3s",
          transitionTimingFunction: info?.timingFunction ?? "ease",
        });
      }
    } catch {
      // Element may have become detached — skip
    }
  }

  // Move mouse away to reset hover states
  await page.mouse.move(0, 0);

  return results;
}

// ---------------------------------------------------------------------------
// Style capture & diff utilities
// ---------------------------------------------------------------------------

async function captureElementStyles(
  page: Page,
  selectors: string[],
): Promise<StyleSnapshot[]> {
  return page.evaluate(
    ({ sels, props }: { sels: string[]; props: string[] }) => {
      /**
       * Safely query an element by selector. Selectors built from class names
       * may contain Tailwind JIT characters (`|`, `:`, `/`) that are invalid
       * in CSS selectors. We rebuild class-based selectors using CSS.escape().
       */
      const safeQuery = (sel: string): Element | null => {
        try {
          return document.querySelector(sel);
        } catch {
          // Selector contains special characters — try escaping class parts
          try {
            const escaped = sel.replace(
              /\.([^\s.>#~+[\]:]+)/g,
              (_match, cls: string) => '.' + CSS.escape(cls),
            );
            return document.querySelector(escaped);
          } catch {
            return null;
          }
        }
      };

      return sels.map(sel => {
        const el = safeQuery(sel);
        const styles: Record<string, string> = {};
        if (el) {
          const computed = getComputedStyle(el);
          for (const prop of props) {
            styles[prop] = computed.getPropertyValue(prop);
          }
        }
        return { selector: sel, styles };
      });
    },
    { sels: selectors, props: [...TRACKED_STYLE_PROPERTIES] },
  );
}

function diffStyles(
  initial: StyleSnapshot[],
  current: StyleSnapshot[],
  scrollY: number,
): ScrollStyleDiff[] {
  const results: ScrollStyleDiff[] = [];
  for (let i = 0; i < initial.length; i++) {
    const changes = diffSingleElement(initial[i], current[i]);
    if (changes.length > 0) {
      results.push({
        selector: initial[i].selector,
        scrollY,
        changes,
      });
    }
  }
  return results;
}

function diffSingleElement(
  before: StyleSnapshot | undefined,
  after: StyleSnapshot | undefined,
): Array<{ property: string; from: string; to: string }> {
  if (!before || !after) return [];
  const changes: Array<{ property: string; from: string; to: string }> = [];
  for (const prop of Object.keys(before.styles)) {
    const fromVal = before.styles[prop];
    const toVal = after.styles[prop];
    if (fromVal !== toVal) {
      changes.push({ property: prop, from: fromVal, to: toVal });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// AnimationSpec builders
// ---------------------------------------------------------------------------

let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Reset the ID counter — useful for deterministic testing. */
export function resetIdCounter(): void {
  idCounter = 0;
}

function buildCssTransitionSpecs(transitions: CssTransitionInfo[]): AnimationSpec[] {
  return transitions.map(t => ({
    id: nextId("css-trans"),
    type: "css-transition" as AnimationType,
    trigger: { type: "hover" as const },
    properties: parseTransitionProperties(t.property),
    duration: parseCssDuration(t.duration),
    easing: t.timingFunction,
    delay: parseCssDuration(t.delay),
    iterations: 1,
    direction: "normal" as AnimationDirection,
    fillMode: "none" as AnimationFillMode,
    elementSelector: t.selector,
    humanDescription: describeTransition(t),
    implementationNotes: notesForTransition(t),
  }));
}

function buildCssAnimationSpecs(
  animations: CssAnimationInfo[],
  keyframeMap: Map<string, AnimationKeyframe[]>,
): AnimationSpec[] {
  return animations.map(a => ({
    id: nextId("css-anim"),
    type: "css-animation" as AnimationType,
    trigger: { type: "load" as const },
    properties: extractPropertiesFromKeyframes(keyframeMap.get(a.animationName) ?? []),
    duration: parseCssDuration(a.duration),
    easing: a.timingFunction,
    delay: parseCssDuration(a.delay),
    iterations: a.iterationCount === "infinite" ? ("infinite" as const) : parseFloat(a.iterationCount) || 1,
    direction: normalizeDirection(a.direction),
    fillMode: normalizeFillMode(a.fillMode),
    keyframes: keyframeMap.get(a.animationName),
    elementSelector: a.selector,
    humanDescription: describeCssAnimation(a),
    implementationNotes: notesForCssAnimation(a, keyframeMap.has(a.animationName)),
  }));
}

function buildIntersectionObserverSpecs(
  observers: ObserverRecord[],
  scrollDiffs: ScrollStyleDiff[],
): AnimationSpec[] {
  const specs: AnimationSpec[] = [];
  const seen = new Set<string>();

  for (const obs of observers) {
    if (seen.has(obs.selector)) continue;
    seen.add(obs.selector);

    // Find any style diffs captured during scroll for this selector
    const diffs = scrollDiffs.filter(d => d.selector === obs.selector);
    const properties = mergeScrollDiffProperties(diffs);

    const trigger: AnimationTrigger = {
      type: "intersection",
      threshold: typeof obs.threshold === "number" ? obs.threshold : undefined,
      rootMargin: obs.rootMargin,
    };

    specs.push({
      id: nextId("io"),
      type: "intersection-observer",
      trigger,
      properties,
      duration: estimateDurationFromProperties(properties),
      easing: "ease",
      delay: 0,
      iterations: 1,
      direction: "normal",
      fillMode: "forwards",
      elementSelector: obs.selector,
      humanDescription: describeIntersectionAnimation(obs, properties),
      implementationNotes: notesForIntersection(obs, properties),
    });
  }

  return specs;
}

function buildWebAnimationSpecs(records: WebAnimationRecord[]): AnimationSpec[] {
  return records.map(rec => {
    const keyframes = normalizeWebAnimKeyframes(rec.keyframes);
    const properties = extractPropertiesFromKeyframes(keyframes);

    return {
      id: nextId("web-anim"),
      type: "css-animation" as AnimationType,
      trigger: { type: "load" as const },
      properties,
      duration: typeof rec.options.duration === "number" ? rec.options.duration : 300,
      easing: (rec.options.easing as string) ?? "ease",
      delay: typeof rec.options.delay === "number" ? rec.options.delay : 0,
      iterations:
        rec.options.iterations === Infinity
          ? ("infinite" as const)
          : (rec.options.iterations ?? 1),
      direction: normalizeDirection(rec.options.direction ?? "normal"),
      fillMode: normalizeFillMode(rec.options.fill ?? "none"),
      keyframes,
      elementSelector: rec.selector,
      humanDescription: describeWebAnimation(properties, rec.options.duration),
      implementationNotes: "Recreate with Element.animate() or CSS @keyframes.",
    };
  });
}

function buildScrollListenerSpecs(records: ScrollListenerRecord[]): AnimationSpec[] {
  if (records.length === 0) return [];

  // Group by target
  const byTarget = new Map<string, number>();
  for (const rec of records) {
    byTarget.set(rec.target, (byTarget.get(rec.target) ?? 0) + 1);
  }

  const specs: AnimationSpec[] = [];
  for (const [target, count] of byTarget) {
    specs.push({
      id: nextId("scroll-lsn"),
      type: "scroll-listener",
      trigger: { type: "scroll-position", scrollContainer: target === "window" ? undefined : target },
      properties: [],
      duration: 0,
      easing: "linear",
      delay: 0,
      iterations: "infinite",
      direction: "normal",
      fillMode: "none",
      elementSelector: target === "window" ? "body" : target,
      humanDescription: `Scroll event listener on ${target} (${count} listener${count > 1 ? "s" : ""} registered)`,
      implementationNotes:
        "Scroll listener detected — inspect page JS to determine specific behavior. Consider using CSS scroll-driven animations or IntersectionObserver for modern replacement.",
    });
  }

  return specs;
}

function buildHoverSpecs(hovers: HoverStyleDiff[]): AnimationSpec[] {
  return hovers.map(h => ({
    id: nextId("hover"),
    type: "css-transition" as AnimationType,
    trigger: { type: "hover" as const },
    properties: h.changes.map(c => ({
      property: c.property,
      from: c.from,
      to: c.to,
    })),
    duration: parseCssDuration(h.transitionDuration),
    easing: h.transitionTimingFunction,
    delay: 0,
    iterations: 1,
    direction: "normal" as AnimationDirection,
    fillMode: "none" as AnimationFillMode,
    elementSelector: h.selector,
    humanDescription: describeHoverAnimation(h),
    implementationNotes: notesForHoverAnimation(h),
  }));
}

function buildLibrarySpecificSpecs(libraries: LibraryInfo[]): AnimationSpec[] {
  const specs: AnimationSpec[] = [];

  for (const lib of libraries) {
    if (lib.name === "AOS") {
      specs.push({
        id: nextId("aos"),
        type: "intersection-observer",
        trigger: { type: "intersection", threshold: 0.1 },
        properties: [{ property: "opacity", from: "0", to: "1" }, { property: "transform", from: "translateY(20px)", to: "translateY(0)" }],
        duration: 600,
        easing: "ease",
        delay: 0,
        iterations: 1,
        direction: "normal",
        fillMode: "forwards",
        library: lib,
        elementSelector: "[data-aos]",
        humanDescription: "AOS library detected — elements with [data-aos] attributes animate on scroll into view.",
        implementationNotes: "Replace with IntersectionObserver + CSS transitions. Check data-aos attribute values for specific animation types (fade-up, fade-in, zoom-in, etc.).",
      });
    }

    if (lib.name === "GSAP" || lib.name === "GSAP ScrollTrigger") {
      specs.push({
        id: nextId("gsap"),
        type: "gsap",
        trigger: { type: "load" },
        properties: [],
        duration: 0,
        easing: "power2.out",
        delay: 0,
        iterations: 1,
        direction: "normal",
        fillMode: "forwards",
        library: lib,
        elementSelector: "body",
        humanDescription: "GSAP animation library detected. Specific tweens and timelines need manual inspection.",
        implementationNotes: "Install gsap package. Use browser DevTools to inspect GSAP timelines via gsap.globalTimeline. Consider replacing simple animations with CSS transitions/animations.",
      });
    }
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Keyframe & property parsing
// ---------------------------------------------------------------------------

function buildKeyframeMap(rules: ParsedKeyframesRule[]): Map<string, AnimationKeyframe[]> {
  const map = new Map<string, AnimationKeyframe[]>();
  for (const rule of rules) {
    map.set(rule.name, rule.keyframes);
  }
  return map;
}

function extractPropertiesFromKeyframes(keyframes: AnimationKeyframe[]): AnimatedProperty[] {
  if (keyframes.length < 2) return [];

  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  const properties: AnimatedProperty[] = [];

  for (const prop of Object.keys(first.styles)) {
    const from = first.styles[prop];
    const to = last.styles[prop];
    if (from !== to) {
      properties.push({ property: prop, from, to });
    }
  }
  return properties;
}

function normalizeWebAnimKeyframes(
  raw: Record<string, string>[] | Keyframe[],
): AnimationKeyframe[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw.map((kf, i) => {
    const offset = typeof kf.offset === "number" ? kf.offset : i / Math.max(raw.length - 1, 1);
    const styles: Record<string, string> = {};
    for (const [key, val] of Object.entries(kf)) {
      if (key === "offset" || key === "easing" || key === "composite") continue;
      if (typeof val === "string") {
        // Convert camelCase to kebab-case
        styles[key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())] = val;
      }
    }
    return {
      offset,
      styles,
      easing: typeof kf.easing === "string" ? kf.easing : undefined,
    };
  });
}

function parseTransitionProperties(prop: string): AnimatedProperty[] {
  return prop
    .split(",")
    .map(p => p.trim())
    .filter(p => p && p !== "all")
    .map(p => ({ property: p, from: "", to: "" }));
}

// ---------------------------------------------------------------------------
// Duration & normalization helpers
// ---------------------------------------------------------------------------

function parseCssDuration(value: string): number {
  if (!value || value === "0s") return 0;
  // Handle comma-separated durations — take the first
  const first = value.split(",")[0].trim();
  if (first.endsWith("ms")) return parseFloat(first);
  if (first.endsWith("s")) return parseFloat(first) * 1000;
  return 0;
}

function normalizeDirection(raw: string): AnimationDirection {
  const valid: AnimationDirection[] = ["normal", "reverse", "alternate", "alternate-reverse"];
  return valid.includes(raw as AnimationDirection) ? (raw as AnimationDirection) : "normal";
}

function normalizeFillMode(raw: string): AnimationFillMode {
  const valid: AnimationFillMode[] = ["none", "forwards", "backwards", "both"];
  return valid.includes(raw as AnimationFillMode) ? (raw as AnimationFillMode) : "none";
}

function estimateDurationFromProperties(properties: AnimatedProperty[]): number {
  // Heuristic: if we detected opacity/transform changes, typical duration is 400-600ms
  if (properties.some(p => p.property === "opacity" || p.property === "transform")) {
    return 500;
  }
  return 300;
}

// ---------------------------------------------------------------------------
// Human-readable description generators
// ---------------------------------------------------------------------------

function describeTransition(t: CssTransitionInfo): string {
  const props = t.property === "all" ? "all properties" : t.property;
  return `CSS transition on ${props} (${t.duration} ${t.timingFunction})`;
}

function describeCssAnimation(a: CssAnimationInfo): string {
  const repeat =
    a.iterationCount === "infinite"
      ? ", loops infinitely"
      : a.iterationCount !== "1"
        ? `, repeats ${a.iterationCount}x`
        : "";
  return `CSS @keyframes "${a.animationName}" (${a.duration} ${a.timingFunction}${repeat})`;
}

function describeIntersectionAnimation(
  obs: ObserverRecord,
  properties: AnimatedProperty[],
): string {
  if (properties.length === 0) {
    return `Element observed via IntersectionObserver (threshold: ${obs.threshold ?? "default"})`;
  }

  const parts: string[] = [];
  const hasOpacity = properties.some(p => p.property === "opacity");
  const hasTransform = properties.some(p => p.property === "transform");

  if (hasOpacity && hasTransform) {
    parts.push("Fades in with transform");
  } else if (hasOpacity) {
    parts.push("Fades in");
  } else if (hasTransform) {
    parts.push("Slides/transforms in");
  }

  if (parts.length === 0) {
    const propNames = properties.map(p => p.property).join(", ");
    parts.push(`Animates ${propNames}`);
  }

  parts.push("when scrolled into view");
  return parts.join(" ");
}

function describeWebAnimation(properties: AnimatedProperty[], duration: unknown): string {
  const dur = typeof duration === "number" ? `${duration}ms` : "unknown duration";
  if (properties.length === 0) return `Web Animation API call (${dur})`;
  const propNames = properties.map(p => p.property).join(", ");
  return `Web Animation: ${propNames} (${dur})`;
}

function describeHoverAnimation(h: HoverStyleDiff): string {
  const propNames = h.changes.map(c => c.property).join(", ");
  return `Hover effect: ${propNames} transitions (${h.transitionDuration})`;
}

// ---------------------------------------------------------------------------
// Implementation note generators
// ---------------------------------------------------------------------------

function notesForTransition(t: CssTransitionInfo): string {
  return `Apply CSS: transition: ${t.property} ${t.duration} ${t.timingFunction} ${t.delay}. Add hover/focus styles to trigger.`;
}

function notesForCssAnimation(a: CssAnimationInfo, hasKeyframes: boolean): string {
  const kfNote = hasKeyframes
    ? `Keyframes for "${a.animationName}" were captured.`
    : `Keyframes for "${a.animationName}" could not be extracted (possibly from a cross-origin stylesheet).`;
  return `${kfNote} Apply CSS: animation: ${a.animationName} ${a.duration} ${a.timingFunction} ${a.delay} ${a.iterationCount} ${a.direction} ${a.fillMode}.`;
}

function notesForIntersection(obs: ObserverRecord, properties: AnimatedProperty[]): string {
  const threshold = obs.threshold ?? 0.1;
  const rootMargin = obs.rootMargin ?? "0px";

  if (properties.length === 0) {
    return `Use IntersectionObserver with threshold ${threshold}, rootMargin "${rootMargin}". Inspect page JS for the callback behavior.`;
  }

  const styleChanges = properties
    .map(p => `${p.property}: ${p.from} → ${p.to}`)
    .join("; ");

  return `Use IntersectionObserver (threshold: ${threshold}, rootMargin: "${rootMargin}"). On intersect, transition: ${styleChanges}. Apply CSS transitions for smooth animation.`;
}

function notesForHoverAnimation(h: HoverStyleDiff): string {
  const changes = h.changes.map(c => `${c.property}: ${c.from} → ${c.to}`).join("; ");
  return `On hover, apply: ${changes}. Use transition: ${h.transitionDuration} ${h.transitionTimingFunction}.`;
}

// ---------------------------------------------------------------------------
// GSAP ScrollTrigger spec builder (Item 1.3)
// ---------------------------------------------------------------------------

function buildScrollTriggerSpecs(records: ScrollTriggerRecord[]): AnimationSpec[] {
  const specs: AnimationSpec[] = [];
  const seen = new Set<string>();

  for (const st of records) {
    const key = `${st.trigger ?? "unknown"}|${st.start ?? ""}|${st.end ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pinLabel = st.pin ? "pinned, " : "";
    const scrubLabel = st.scrub ? `scrub=${String(st.scrub)}, ` : "";
    const startLabel = st.start ?? "top center";
    const endLabel = st.end ?? "bottom center";

    specs.push({
      id: nextId("gsap-st"),
      type: "gsap",
      trigger: {
        type: st.scrub ? "scroll-progress" : "scroll-position",
      },
      properties: (st.animatedProperties ?? []).map(prop => ({
        property: prop,
        from: "",
        to: "",
      })),
      duration: 0,
      easing: "none",
      delay: 0,
      iterations: 1,
      direction: "normal",
      fillMode: "none",
      elementSelector: st.trigger ?? "unknown",
      gsapScrollTriggerConfig: {
        pin: st.pin,
        scrub: st.scrub,
        start: st.start,
        end: st.end,
        snap: st.snap,
        markers: st.markers,
        toggleClass: st.toggleClass,
        toggleActions: st.toggleActions,
        callbacksPresent: {
          onEnter: st.onEnter,
          onLeave: st.onLeave,
          onUpdate: st.onUpdate,
          onToggle: st.onToggle,
          onEnterBack: st.onEnterBack,
          onLeaveBack: st.onLeaveBack,
        },
      },
      humanDescription: `GSAP ScrollTrigger: ${pinLabel}${scrubLabel}start="${startLabel}", end="${endLabel}"`,
      implementationNotes: `Install gsap and register ScrollTrigger. Use gsap.to() with scrollTrigger config.${st.pin ? " Element is pinned during scroll." : ""}${st.scrub ? " Animation progress is linked to scroll position." : ""}`,
    });
  }

  return specs;
}

// ---------------------------------------------------------------------------
// IO effects merger (Item 1.4)
// ---------------------------------------------------------------------------

function mergeIOEffectsIntoSpecs(
  specs: AnimationSpec[],
  effects: IOEffectRecord[],
): void {
  for (const spec of specs) {
    const matchingEffects = effects.filter(e => e.selector === spec.elementSelector);
    if (matchingEffects.length === 0) continue;

    // Take the first matching effect (most relevant)
    const effect = matchingEffects[0];

    spec.ioEffects = {
      classesAdded: effect.classesAdded,
      classesRemoved: effect.classesRemoved,
      styleChanged: effect.styleChanged,
      newStyle: effect.newStyle || undefined,
    };

    // Enrich implementation notes with captured class names
    const classParts: string[] = [];
    if (effect.classesAdded.length > 0) {
      classParts.push(`Classes added on intersect: "${effect.classesAdded.join('", "')}"`);
    }
    if (effect.classesRemoved.length > 0) {
      classParts.push(`Classes removed on intersect: "${effect.classesRemoved.join('", "')}"`);
    }
    if (effect.styleChanged && effect.newStyle) {
      classParts.push(`Inline style changed to: "${effect.newStyle}"`);
    }

    if (classParts.length > 0) {
      spec.implementationNotes += ` Captured IO callback effects: ${classParts.join(". ")}.`;
    }
  }
}

// ---------------------------------------------------------------------------
// Stagger pattern detection (Item 1.6)
// ---------------------------------------------------------------------------

interface RawStaggerPattern {
  containerSelector: string;
  childSelector: string;
  childCount: number;
  delayIncrement: number;
  totalDuration: number;
  direction: 'forward' | 'reverse';
  animationType: 'css-animation' | 'css-transition';
}

async function detectStaggerPatterns(page: Page): Promise<StaggerPattern[]> {
  const rawPatterns = await page.evaluate(() => {
    const patterns: Array<{
      containerSelector: string;
      childSelector: string;
      childCount: number;
      delayIncrement: number;
      totalDuration: number;
      direction: 'forward' | 'reverse';
      animationType: 'css-animation' | 'css-transition';
    }> = [];

    /** Build a minimal CSS selector for an element. */
    function miniSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === 'string'
        ? el.className.trim().split(/\s+/)[0]
        : '';
      return cls ? `${tag}.${cls}` : tag;
    }

    // Find container elements that might hold staggered children.
    const containerSelectors = [
      'ul', 'ol', 'nav',
      '[class*="grid"]', '[class*="list"]', '[class*="cards"]',
      '[class*="features"]', '[class*="items"]', '[class*="stagger"]',
    ];

    const containers = document.querySelectorAll(containerSelectors.join(', '));

    for (const container of Array.from(containers)) {
      const children = Array.from(container.children).filter(c => {
        const cs = getComputedStyle(c);
        return cs.display !== 'none';
      });

      if (children.length < 2) continue;

      // Check for animation delays
      const animDelays: number[] = [];
      const transDelays: number[] = [];
      let hasAnimation = false;
      let hasTransition = false;

      for (const child of children) {
        const cs = getComputedStyle(child);
        const animDelay = parseFloat(cs.animationDelay) || 0;
        const transDelay = parseFloat(cs.transitionDelay) || 0;
        animDelays.push(animDelay * 1000);
        transDelays.push(transDelay * 1000);
        if (cs.animationName !== 'none') hasAnimation = true;
        if (cs.transitionProperty !== 'all' && cs.transitionProperty !== 'none') {
          hasTransition = true;
        }
      }

      // Check animation delays for arithmetic sequence
      const delayArrays: Array<{ delays: number[]; type: 'css-animation' | 'css-transition' }> = [];
      if (hasAnimation) delayArrays.push({ delays: animDelays, type: 'css-animation' });
      if (hasTransition) delayArrays.push({ delays: transDelays, type: 'css-transition' });

      for (const { delays, type } of delayArrays) {
        // Need at least one non-zero delay difference
        const hasNonZero = delays.some((d, i) => i > 0 && Math.abs(d - delays[i - 1]) > 5);
        if (!hasNonZero) continue;

        const diffs: number[] = [];
        for (let i = 1; i < delays.length; i++) {
          diffs.push(Math.round(delays[i] - delays[i - 1]));
        }

        const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        if (Math.abs(avgDiff) < 10) continue;

        const isStagger = diffs.every(d => Math.abs(d - avgDiff) < 20);
        if (!isStagger) continue;

        const direction = avgDiff > 0 ? 'forward' as const : 'reverse' as const;
        const firstChild = children[0];

        patterns.push({
          containerSelector: miniSelector(container),
          childSelector: miniSelector(firstChild),
          childCount: children.length,
          delayIncrement: Math.round(Math.abs(avgDiff)),
          totalDuration: Math.abs(delays[delays.length - 1] - delays[0]),
          direction,
          animationType: type,
        });
      }
    }

    return patterns;
  });

  return rawPatterns.map((p) => ({
    ...p,
    animationType: p.animationType as AnimationType,
  }));
}

// ---------------------------------------------------------------------------
// Deduplication & utilities
// ---------------------------------------------------------------------------

function deduplicateAnimations(animations: AnimationSpec[]): AnimationSpec[] {
  const seen = new Map<string, AnimationSpec>();

  for (const anim of animations) {
    const key = `${anim.elementSelector}|${anim.type}|${anim.trigger.type}`;
    const existing = seen.get(key);

    // Keep the one with more properties (richer data)
    if (!existing || anim.properties.length > existing.properties.length) {
      seen.set(key, anim);
    }
  }

  return Array.from(seen.values());
}

function uniqueSelectors(selectors: string[]): string[] {
  const unique = [...new Set(selectors)].filter(s => s && s !== "body");
  return unique.slice(0, MAX_SELECTOR_ELEMENTS);
}

function mergeScrollDiffProperties(diffs: ScrollStyleDiff[]): AnimatedProperty[] {
  const propMap = new Map<string, { from: string; to: string }>();

  for (const diff of diffs) {
    for (const change of diff.changes) {
      const existing = propMap.get(change.property);
      if (!existing) {
        propMap.set(change.property, { from: change.from, to: change.to });
      } else {
        // Keep the original `from` but update `to` with the latest value
        propMap.set(change.property, { from: existing.from, to: change.to });
      }
    }
  }

  return Array.from(propMap.entries()).map(([property, vals]) => ({
    property,
    from: vals.from,
    to: vals.to,
  }));
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
