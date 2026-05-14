export type PrimitiveConfig = {
  primitives: {
    [name: string]: {
      tag: string;
      matchClasses?: string[];
      matchTags?: string[];
      variants?: Record<string, string>;
      sizes?: Record<string, string>;
      passThroughClasses?: boolean;
    };
  };
};

export const config: PrimitiveConfig = {
  primitives: {
    Container: { tag: 'div', matchClasses: ['wrp', 'container'] },
    Button: {
      tag: 'button',
      matchClasses: ['button'],
      variants: { ghost: 'button--ghost', white: 'button--white' },
    },
    Heading: {
      tag: 'h2',
      matchClasses: ['title'],
      sizes: {
        xl: 'title--xl',
        l: 'title--l',
        m: 'title--m',
        s: 'title--s',
      },
    },
    Text: {
      tag: 'p',
      matchClasses: ['text'],
      sizes: {
        xl: 'text--xl',
        l: 'text--l',
        m: 'text--m',
        s: 'text--s',
      },
    },
    Link: { tag: 'a', matchTags: ['a-link'] },
    Icon: { tag: 'span', matchClasses: ['icon'] },
    Section: { tag: 'section', matchTags: ['section'] },
    Grid: { tag: 'div', matchClasses: ['grid__layout'] },
  },
};
