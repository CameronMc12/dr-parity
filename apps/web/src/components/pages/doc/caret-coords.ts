/**
 * Pixel coordinates of the caret inside a <textarea>. Textareas expose no native
 * caret-rect API, so we mirror the textarea into a hidden div that copies the
 * relevant typography + box metrics, place a marker span at the caret offset,
 * and read the marker's position. Returns coords relative to the textarea's
 * offsetParent so an absolutely-positioned popover lines up with the caret.
 *
 * Adapted from the well-known "textarea-caret-position" technique.
 */

const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'whiteSpace',
  'wordWrap',
  'tabSize',
] as const;

export interface CaretPoint {
  top: number;
  left: number;
}

export function caretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): CaretPoint {
  const div = document.createElement('div');
  const style = div.style;
  const computed = window.getComputedStyle(textarea);

  style.position = 'absolute';
  style.visibility = 'hidden';
  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.overflow = 'hidden';

  for (const prop of MIRROR_PROPS) {
    const value = computed[prop as keyof CSSStyleDeclaration];
    if (typeof value === 'string') {
      style.setProperty(camelToKebab(prop), value);
    }
  }

  div.textContent = textarea.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(position) || '.';
  div.appendChild(marker);

  document.body.appendChild(div);
  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;
  document.body.removeChild(div);

  return { top, left };
}

function camelToKebab(prop: string): string {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
