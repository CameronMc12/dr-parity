/**
 * Generic client-side interaction layer for the VERBATIM webapp body.
 *
 * The webapp target renders the captured body through
 * `dangerouslySetInnerHTML`, so React never owns those DOM nodes and JSX
 * `onClick` handlers cannot be used. This module emits a single, defensive
 * post-mount effect that querySelectors well-known captured structures and
 * binds plain `addEventListener` handlers — the same pattern as the existing
 * `data-dr-parity-*` trigger wiring, but for interactions that do not depend
 * on inferred state toggles.
 *
 * Every selector lookup is optional: if a structure is not present in the
 * captured DOM the corresponding block is a no-op and never throws. This keeps
 * the layer site-agnostic. It currently wires three interactions observed
 * across captured app shells:
 *
 *   1. Tab switching — `[role="tab"]` siblings. Clicking a tab moves the
 *      `active` class (and the `*_active` icon/label modifier classes) to the
 *      clicked tab. Pure client-side visual switch, no navigation.
 *   2. Search modal — a captured `<dialog class="modal">` is force-hidden by
 *      `neutraliseOpenOverlays`. Clicking a search toggle un-hides it; Escape
 *      or a backdrop click hides it again.
 *   3. Sidebar nav active state — clicking a sidebar nav item moves its active
 *      class so the rail reflects the current selection.
 *
 * The emitted code is framework-free DOM JS embedded as a single `useEffect`
 * body. It is intentionally written as string lines (not a real module) because
 * it has to live inside the generated component file.
 */

/** Marker attr so the layer can hide the search modal again on demand. */
export const SEARCH_OPEN_ATTR = 'data-dr-parity-search-open';

/** CSS injected by `buildSidebarStyleTag` keys off these stable class names. */
export const SIDEBAR_HOST_SELECTOR = 'cu-simple-bar';

/**
 * The collapsed ClickUp nav rail (Home / Spaces / Chat / More / Invite /
 * Upgrade) renders at the navigation-bar width with labels stacked under each
 * icon. ClickUp sets this width via runtime JS we do not run, so the captured
 * host collapses to a hairline. 78px restores the rail to its natural
 * collapsed-with-labels width without overlapping the main content (the host
 * is a flex sibling of the router outlet, so a fixed basis offsets the page
 * correctly).
 */
const SIDEBAR_RAIL_WIDTH_PX = 78;

/**
 * A `<style>` tag, emitted into the verbatim body head, that restores the
 * captured sidebar's width. Targets the captured structure generically rather
 * than being hand-edited into the output. `!important` is required to beat the
 * runtime-collapsed inline width the capture froze onto the host.
 */
export function buildSidebarStyleTag(): string {
  const w = `${SIDEBAR_RAIL_WIDTH_PX}px`;
  const css = [
    `${SIDEBAR_HOST_SELECTOR}{width:${w} !important;min-width:${w} !important;flex:0 0 ${w} !important;}`,
    `${SIDEBAR_HOST_SELECTOR} .cu-simple-bar__container{width:${w} !important;min-width:${w} !important;}`,
    // Keep the rail above adjacent panes so flyout labels are not clipped.
    `${SIDEBAR_HOST_SELECTOR}{position:relative;z-index:5;}`,
  ].join('');
  return `<style data-dr-parity-sidebar="1">${css}</style>`;
}

/**
 * Emit the interaction-layer effect body. Returns the lines to splice into the
 * component and whether `useEffect` / a body ref are required. The caller binds
 * these against the same `bodyRef` used by the trigger-wiring effect.
 */
export function emitInteractionEffect(): { lines: string[]; needsEffect: boolean } {
  const lines: string[] = [];
  lines.push('  useEffect(() => {');
  lines.push('    const root = bodyRef.current;');
  lines.push('    if (!root) return;');
  lines.push('    const cleanups: Array<() => void> = [];');
  lines.push('    const on = (el: Element, type: string, fn: (e: Event) => void) => {');
  lines.push('      el.addEventListener(type, fn);');
  lines.push('      cleanups.push(() => el.removeEventListener(type, fn));');
  lines.push('    };');
  lines.push('');
  lines.push(...tabSwitchingLines());
  lines.push('');
  lines.push(...searchModalLines());
  lines.push('');
  lines.push(...sidebarNavLines());
  lines.push('');
  lines.push('    return () => { for (const c of cleanups) c(); };');
  lines.push('    // eslint-disable-next-line react-hooks/exhaustive-deps');
  lines.push('  }, []);');
  return { lines, needsEffect: true };
}

/** Tab switching: move `active` + `*_active` modifiers to the clicked tab. */
function tabSwitchingLines(): string[] {
  return [
    "    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role=\"tab\"]'));",
    '    if (tabs.length > 1) {',
    '      const moveActive = (target: HTMLElement) => {',
    '        for (const tab of tabs) {',
    '          const isTarget = tab === target;',
    "          tab.classList.toggle('active', isTarget);",
    "          tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');",
    "          tab.querySelectorAll('[class*=\"_active\"]').forEach((node) => {",
    '            const cls = node.getAttribute(\'class\') ?? \'\';',
    "            node.setAttribute(",
    "              'class',",
    "              cls.replace(/\\b([\\w-]+)_active\\b/g, isTarget ? '$1_active' : '$1'),",
    '            );',
    '          });',
    '        }',
    '      };',
    '      for (const tab of tabs) {',
    "        on(tab, 'click', (e) => { e.preventDefault(); moveActive(tab); });",
    '      }',
    '    }',
  ];
}

/** Search modal: un-hide the captured dialog on toggle, hide on Escape/backdrop. */
function searchModalLines(): string[] {
  return [
    "    const modal = root.querySelector<HTMLElement>('dialog.modal');",
    "    const toggle = root.querySelector<HTMLElement>(",
    "      'cu-search-modal-toggle, .search-modal-toggle, .search-button',",
    '    );',
    '    if (modal && toggle) {',
    "      const backdrop = modal.querySelector<HTMLElement>('.modal-backdrop');",
    '      const setOpen = (open: boolean) => {',
    "        modal.style.setProperty('display', open ? 'flex' : 'none', 'important');",
    '        if (open) {',
    "          modal.removeAttribute('hidden');",
    `          modal.setAttribute('${SEARCH_OPEN_ATTR}', '1');`,
    '        } else {',
    `          modal.removeAttribute('${SEARCH_OPEN_ATTR}');`,
    '        }',
    "        if (backdrop) backdrop.style.setProperty('display', open ? 'block' : 'none', 'important');",
    '      };',
    "      on(toggle, 'click', (e) => { e.preventDefault(); setOpen(true); });",
    '      if (backdrop) {',
    "        on(backdrop, 'click', () => setOpen(false));",
    '      }',
    '      const onKey = (e: Event) => {',
    `        if ((e as KeyboardEvent).key === 'Escape' && modal.getAttribute('${SEARCH_OPEN_ATTR}') === '1') {`,
    '          setOpen(false);',
    '        }',
    '      };',
    "      document.addEventListener('keydown', onKey);",
    "      cleanups.push(() => document.removeEventListener('keydown', onKey));",
    '    }',
  ];
}

/** Sidebar nav: move the `active`/`cu-simple-bar__item_active` class on click. */
function sidebarNavLines(): string[] {
  return [
    "    const navItems = Array.from(",
    "      root.querySelectorAll<HTMLElement>('cu-simple-bar .cu-simple-bar__item'),",
    '    );',
    '    if (navItems.length > 1) {',
    '      for (const item of navItems) {',
    "        on(item, 'click', () => {",
    '          for (const other of navItems) {',
    "            other.classList.remove('active', 'cu-simple-bar__item_active');",
    '          }',
    "          item.classList.add('active', 'cu-simple-bar__item_active');",
    '        });',
    '      }',
    '    }',
  ];
}
