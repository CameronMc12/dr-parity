/**
 * Inline 24x24 stroke/fill icons used inside the Home menus. The shared
 * CuIconSprite only carries a handful of sidebar glyphs, so the menu-specific
 * icons (task, message, list, channel, space, mark-read, pin, sort, limit,
 * shuffle, browse, archive, show, import, templates) are defined here to match
 * the captured `cu3-icon-*` symbols 1:1 in shape and weight.
 */

interface IconProps {
  size?: number;
}

function S({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const TaskIcon = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" {...stroke} />
    <path d="M8.5 12l2.4 2.4 4.6-4.8" {...stroke} />
  </S>
);

export const MessageIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M4 12.5L19.5 5 13.5 19.5l-2.4-6.2L4 12.5z" {...stroke} />
  </S>
);

export const ListIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M9 7h10M9 12h10M9 17h10" {...stroke} />
    <path d="M5 7l1 1 1.6-2M5 12l1 1 1.6-2M5 17l1 1 1.6-2" {...stroke} />
  </S>
);

export const ChannelIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M9 4L7.5 20M16.5 4L15 20M5 9h14M4.5 15h14" {...stroke} />
  </S>
);

export const SpaceIcon = (p: IconProps) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.2" {...stroke} />
    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-30 12 12)" {...stroke} />
  </S>
);

export const DocIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2" fill="rgb(38,132,255)" />
    <path d="M8 8h8M8 11.5h8M8 15h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
  </S>
);

export const FormIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" fill="rgb(124,77,255)" />
    <path d="M8 9l1.2 1.2 2.2-2.4M8 14l1.2 1.2 2.2-2.4M14 9h2.5M14 14h2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </S>
);

export const DashboardIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" fill="rgb(124,77,255)" />
    <path d="M8 16v-3M12 16V9M16 16v-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
  </S>
);

export const WhiteboardIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="3.5" y="4" width="17" height="13" rx="2" fill="rgb(255,184,0)" />
    <path d="M12 17v3M9.5 20h5" stroke="rgb(180,120,0)" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 8.5l3 3 4-4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </S>
);

export const CustomizeSidebarIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" {...stroke} />
    <path d="M9.5 4v16" {...stroke} />
    <path d="M13 10h4M13 13.5h4" {...stroke} />
  </S>
);

export const ImportIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M12 4v9m0 0l-3.2-3.2M12 13l3.2-3.2" {...stroke} />
    <path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-2" {...stroke} />
  </S>
);

export const TemplatesIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="4" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="4" y="13" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="13" width="7" height="7" rx="1.6" {...stroke} />
  </S>
);

export const CheckAllIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M3 13l3 3 6-7" {...stroke} />
    <path d="M11 13l1.5 1.5 6-7" {...stroke} />
  </S>
);

export const AddToListIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M4 7h11M4 12h7M4 17h7" {...stroke} />
    <path d="M16 14.5v5M13.5 17h5" {...stroke} />
  </S>
);

export const PinIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3-1-5z" {...stroke} />
    <path d="M12 13.5V20" {...stroke} />
  </S>
);

export const SortIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M7 4v16M7 4L4.5 6.8M7 4l2.5 2.8" {...stroke} />
    <path d="M17 20V4M17 20l2.5-2.8M17 20l-2.5-2.8" {...stroke} />
  </S>
);

export const AddIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" {...stroke} />
  </S>
);

export const ShuffleIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M4 6h3.5l9 12H20" {...stroke} />
    <path d="M16.5 6H20M17 4l3 2-3 2" {...stroke} />
    <path d="M4 18h3.5l2.4-3.2" {...stroke} />
    <path d="M13.8 9.2L16.5 6" {...stroke} />
    <path d="M17 16l3 2-3 2" {...stroke} />
  </S>
);

export const BrowseIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="4" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="4" y="13" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="13" width="7" height="7" rx="1.6" {...stroke} />
  </S>
);

export const LimitIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M9.5 4l-1.4 16M16 4l-1.4 16M4.5 9h15.5M3.8 15h15.5" {...stroke} />
  </S>
);

export const ManageSpacesIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="4.5" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="4.5" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="4" y="13.5" width="7" height="7" rx="1.6" {...stroke} />
    <rect x="13" y="13.5" width="7" height="7" rx="1.6" {...stroke} />
  </S>
);

export const ShowIcon = (p: IconProps) => (
  <S {...p}>
    <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" {...stroke} />
    <circle cx="12" cy="12" r="2.6" {...stroke} />
  </S>
);

export const ArchiveIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="4" y="5" width="16" height="4" rx="1" {...stroke} />
    <path d="M5.5 9v8.5A1.5 1.5 0 0 0 7 19h10a1.5 1.5 0 0 0 1.5-1.5V9" {...stroke} />
    <path d="M10 12.5h4" {...stroke} />
  </S>
);

export const AiSparkleIcon = (p: IconProps) => (
  <S {...p}>
    <path
      d="M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4L12 4z"
      fill="url(#cuAiGrad)"
    />
    <path d="M18 14l.7 1.8L20.5 16.5 18.7 17.2 18 19l-.7-1.8L15.5 16.5 17.3 15.8 18 14z" fill="url(#cuAiGrad)" />
    <defs>
      <linearGradient id="cuAiGrad" x1="6" y1="4" x2="20" y2="19" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF4D8D" />
        <stop offset="0.5" stopColor="#A24BFF" />
        <stop offset="1" stopColor="#3B9BFF" />
      </linearGradient>
    </defs>
  </S>
);

export const AgentIcon = (p: IconProps) => (
  <S {...p}>
    <rect x="3.5" y="8" width="17" height="9" rx="4.5" fill="rgb(229,57,53)" />
    <circle cx="8.5" cy="12.5" r="2" fill="#fff" />
    <circle cx="15.5" cy="12.5" r="2" fill="#fff" />
    <circle cx="8.5" cy="12.5" r="0.9" fill="rgb(229,57,53)" />
    <circle cx="15.5" cy="12.5" r="0.9" fill="rgb(229,57,53)" />
  </S>
);
