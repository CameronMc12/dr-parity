/**
 * Generated React projects may contain custom elements (web components like
 * `<a-link>`, `<swiper-slider>`) captured from the source site. React's JSX
 * type system rejects unknown lowercase tags by default; this declaration
 * accepts any tag with any attribute so cloned markup passes type-check.
 *
 * NOTE: this file is intended to be *copied into* the generated project
 * during scaffolding. It is not part of the dr-parity engine's own
 * type-check surface.
 */

import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [tag: string]: any;
    }
  }
}

export {};
