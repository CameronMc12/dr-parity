import type { LibSignature } from './types';

export const LIB_REGISTRY: LibSignature[] = [
  {
    id: 'react-beautiful-dnd',
    displayName: 'react-beautiful-dnd',
    detection: {
      domAttrs: ['data-rbd-droppable-id', 'data-rbd-draggable-id'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@hello-pangea/dnd',
      version: '^16.6.0',
      wrapperPath: 'src/lib/react-beautiful-dnd.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      '@hello-pangea/dnd is a near-drop-in maintained fork. Captured JSX should keep working via the wrapper re-export.',
  },
  {
    id: 'dnd-kit',
    displayName: 'dnd-kit',
    detection: {
      domAttrs: ['data-dnd-kit-id', 'data-droppable-id'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@dnd-kit/core',
      version: '^6.1.0',
      wrapperPath: 'src/lib/dnd-kit.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports @dnd-kit/core and @dnd-kit/sortable. Sensor wiring will need a manual pass per draggable component.',
  },
  {
    id: 'react-select',
    displayName: 'react-select',
    detection: {
      classPrefixes: ['react-select__'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: 'react-select',
      version: '^5.8.0',
      wrapperPath: 'src/lib/react-select.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports the default Select. Replace captured option markup with <Select options={...} /> by hand.',
  },
  {
    id: 'headlessui',
    displayName: '@headlessui/react',
    detection: {
      domAttrs: ['data-headlessui-state'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@headlessui/react',
      version: '^2.2.0',
      wrapperPath: 'src/lib/headlessui.tsx',
    },
    swapStrategy: 'attribute-rewrite',
    swapInstructions:
      'Captured data-headlessui-state attributes are left in place. The actual Menu/Listbox/Dialog wiring must be done by hand — wrap interactive sections with the matching @headlessui/react component.',
  },
  {
    id: 'radix-ui',
    displayName: '@radix-ui/react-*',
    detection: {
      domAttrs: [
        'data-radix-portal',
        'data-radix-collection-item',
        'data-state',
        'data-orientation',
        'data-side',
        'data-align',
      ],
      classPrefixes: ['radix-'],
      minOccurrences: 10,
    },
    reactEquivalent: {
      npmPackage: '@radix-ui/react-primitive',
      version: '^2.0.0',
      wrapperPath: 'src/lib/radix-ui.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'Radix is a meta-package — inspect the detected components and install the specific @radix-ui/react-<component> packages (dialog, dropdown-menu, popover, etc.) one by one. Then rewrap the captured markup with the matching primitives.',
  },
  {
    id: 'floating-ui',
    displayName: '@floating-ui/react',
    detection: {
      domAttrs: ['data-floating-ui-portal', 'data-floating-ui-focusable'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@floating-ui/react',
      version: '^0.27.0',
      wrapperPath: 'src/lib/floating-ui.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'Floating UI positions are computed at runtime — the captured DOM only shows where the popover landed, not the trigger logic. Re-attach useFloating + autoUpdate hooks to each detected popover by hand.',
  },
  {
    id: 'framer-motion',
    displayName: 'framer-motion',
    detection: {
      domAttrs: ['data-framer-name', 'data-framer-component', 'data-motion-pop-id'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: 'framer-motion',
      version: '^11.11.0',
      wrapperPath: 'src/lib/framer-motion.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'Framer Motion encodes animations in JS, not the DOM. Captured translate3d styles are dead artifacts. Re-author animations using motion.<element> + animate/initial/exit props.',
  },
  {
    id: 'react-multi-select-component',
    displayName: 'react-multi-select-component',
    detection: {
      domAttrs: ['data-rmsc'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: 'react-multi-select-component',
      version: '^4.3.4',
      wrapperPath: 'src/lib/react-multi-select-component.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports MultiSelect. Replace captured option markup with <MultiSelect options={...} value={...} onChange={...} />.',
  },
  {
    id: 'swiper',
    displayName: 'swiper',
    detection: {
      classPrefixes: ['swiper-container', 'swiper-slide', 'swiper-wrapper'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: 'swiper',
      version: '^11.1.0',
      wrapperPath: 'src/lib/swiper.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports Swiper, SwiperSlide from swiper/react and imports swiper/css. Replace .swiper-slide divs with <SwiperSlide>.',
  },
  {
    id: 'slick-carousel',
    displayName: 'slick-carousel',
    detection: {
      classPrefixes: ['slick-track', 'slick-slide', 'slick-slider'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: 'react-slick',
      version: '^0.30.0',
      wrapperPath: 'src/lib/slick-carousel.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports react-slick Slider and pulls in slick-carousel CSS. Also add "slick-carousel": "^1.8.1" as a peer for the stylesheet.',
  },
  {
    id: 'tippy',
    displayName: 'tippy.js',
    detection: {
      domAttrs: ['data-tippy-root'],
      classPrefixes: ['tippy-box'],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@tippyjs/react',
      version: '^4.2.6',
      wrapperPath: 'src/lib/tippy.tsx',
    },
    swapStrategy: 'wrapper-component',
    swapInstructions:
      'Wrapper re-exports @tippyjs/react default Tippy. Wrap captured trigger elements with <Tippy content="...">.',
  },
  {
    id: 'shadcn-ui',
    displayName: 'shadcn/ui',
    detection: {
      domAttrs: ['data-slot'],
      minOccurrences: 3,
    },
    reactEquivalent: {
      npmPackage: 'class-variance-authority',
      version: '^0.7.0',
      wrapperPath: 'src/lib/shadcn-ui.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'shadcn/ui is a copy-paste component library, not a single npm package. The captured DOM uses Tailwind classes + CVA variants. Install class-variance-authority + tailwind-merge + clsx, then copy each captured component from shadcn registry (https://ui.shadcn.com) into src/components/ui/.',
  },
  {
    id: 'uppy',
    displayName: 'Uppy (file uploader)',
    detection: {
      domAttrs: [
        'data-uppy-theme',
        'data-uppy-drag-drop-supported',
        'data-uppy-super-focusable',
        'data-uppy-num-acquirers',
      ],
      minOccurrences: 1,
    },
    reactEquivalent: {
      npmPackage: '@uppy/react',
      version: '^4.0.0',
      wrapperPath: 'src/lib/uppy.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'Uppy is a stateful uploader UI. The captured static DOM cannot replay the upload flow. Install @uppy/react + @uppy/core + @uppy/dashboard + adapters for your storage target, then replace the captured upload UI with <Dashboard uppy={uppy} />.',
  },
  {
    id: 'recharts',
    displayName: 'Recharts (or similar chart lib)',
    detection: {
      domAttrs: ['data-chart'],
      classPrefixes: ['recharts-'],
      minOccurrences: 2,
    },
    reactEquivalent: {
      npmPackage: 'recharts',
      version: '^2.13.0',
      wrapperPath: 'src/lib/recharts.tsx',
    },
    swapStrategy: 'manual-only',
    swapInstructions:
      'Charts in the captured DOM are static SVG. Recharts (or a similar lib like Chart.js or Visx) needs to be wired with the actual data shape from your MSW fixtures. Inspect the captured SVG structure and build chart components matching that shape.',
  },
];
