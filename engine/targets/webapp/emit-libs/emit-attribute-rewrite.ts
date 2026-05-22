/**
 * Apply string-level JSX rewrites for libs that use the `attribute-rewrite`
 * strategy. Today this is a near-no-op: Headless UI's data-headlessui-state
 * attributes are intentionally left in place because the actual component
 * wiring has to be done by hand. The function is structured so future libs
 * (e.g. drop-in attribute renamings) can be slotted in.
 */

import type { DetectedLib } from '../detect-libs/types';

export function rewriteAttributes(
  jsx: string,
  detected: DetectedLib[],
): string {
  let output = jsx;

  for (const lib of detected) {
    if (lib.signature.swapStrategy !== 'attribute-rewrite') continue;

    if (lib.signature.id === 'headlessui') {
      // Intentional no-op: keeping data-headlessui-state attrs visible so a
      // human reviewer can spot every Menu/Listbox/Dialog candidate. No
      // behavioural change.
      continue;
    }
  }

  return output;
}
