'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SearchIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { useUiStore } from '@/store/ui-store';
import { CommandPalette } from '@/lib/search';
import { UserMenu } from '@/components/shell/UserMenu';

/**
 * Top-bar action glyphs.
 *
 * Path data is lifted verbatim from the real ClickUp vendor sprite
 * (packages/design-system/assets/clickup-vendor/cu3-icon-sprite.svg) so the
 * icons are 1:1 with production. The sprite groups are inlined here (rather
 * than referenced via <use href>) because <CuIconSprite /> only injects a
 * curated subset of symbols that does not include these action icons.
 *
 * Oracle right cluster, left→right: create-task (check+), track-time
 * (stopwatch), record-clip (video), doc, whiteboard, dashboard (bar chart).
 */
function ActionGlyph({
  size = 18,
  children,
}: {
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {children}
    </svg>
  );
}

const CreateTaskGlyph = () => (
  <ActionGlyph>
    <path d="m21.29 5.89-10 10a.994.994 0 0 1-1.41 0l-2.83-2.83a.998.998 0 0 1 1.41-1.41l2.12 2.12 9.29-9.29a.996.996 0 0 1 1.41 0c.4.39.4 1.02.01 1.41ZM12 20c-4.71 0-8.48-4.09-7.95-8.9.39-3.52 3.12-6.41 6.61-6.99 1.81-.3 3.53.02 4.99.78a1.004 1.004 0 0 0 .93-1.78c-1.47-.75-3.13-1.16-4.9-1.11-5.14.16-9.41 4.34-9.67 9.47C1.72 17.24 6.3 22 12 22c1.2 0 2.34-.21 3.41-.6.68-.25.87-1.13.35-1.65a.98.98 0 0 0-1.04-.23c-.85.31-1.77.48-2.72.48Zm7-5h-2c-.55 0-1 .45-1 1s.45 1 1 1h2v2c0 .55.45 1 1 1s1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-2v-2c0-.55-.45-1-1-1s-1 .45-1 1v2Z" />
  </ActionGlyph>
);

const TrackTimeGlyph = () => (
  <ActionGlyph>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.032 3.95c.027.16.075.313.14.456a9.18 9.18 0 0 0-.788.408 16.905 16.905 0 0 0-.432-.414c-.89-.85-2.19-.92-3.08-.18-.15.13-.31.27-.49.45s-.32.34-.45.49c-.74.89-.67 2.19.18 3.08.153.16.34.354.565.582a9.16 9.16 0 0 0-.895 3.968c0 2.46.96 4.77 2.7 6.51a9.145 9.145 0 0 0 6.51 2.7c2.46 0 4.77-.96 6.51-2.7a9.145 9.145 0 0 0 2.7-6.51 9.16 9.16 0 0 0-.892-3.96c.228-.232.42-.431.582-.6.84-.89.92-2.18.18-3.06-.13-.16-.28-.32-.46-.5-.17-.17-.34-.32-.49-.45-.89-.74-2.18-.66-3.07.18-.128.123-.274.263-.437.423a9.105 9.105 0 0 0-.806-.418 1.8 1.8 0 0 0 .143-.455c.04-.2.06-.43.06-.66 0-.23-.02-.46-.06-.66-.15-.88-.92-1.53-1.86-1.58-.49-.03-1.2-.06-2.1-.06-.9 0-1.61.03-2.1.06-.94.06-1.71.7-1.86 1.58-.04.2-.06.43-.06.66 0 .23.02.46.06.66Zm-2.28 2.07-.032.03a9.468 9.468 0 0 0-.95 1.028c-.035-.04-.071-.076-.107-.112a1.96 1.96 0 0 1-.101-.106l-.002-.002c-.052-.063-.217-.26-.088-.418.1-.11.2-.22.33-.35.12-.13.24-.24.35-.33.04-.04.13-.05.13-.05.12 0 .25.1.29.14.024.024.052.05.082.077l.098.093Zm13.587.947a5.04 5.04 0 0 1-.116.122 9.395 9.395 0 0 0-.981-1.06l.102-.096c.03-.028.059-.054.088-.083l.002-.002c.063-.052.26-.216.408-.088.11.09.23.2.36.33.13.13.24.25.33.36.128.148-.036.345-.088.408l-.002.002-.103.107ZM10.012 3.05s-.05.01-.06.01c.024.008.022.079.02.162v.068c0 .11.01.22.03.31.333-.035.766-.03 1.293-.025.217.002.45.005.697.005.84 0 1.514-.03 1.974-.05h.016c.02-.02.04-.13.04-.24 0-.11-.01-.22-.03-.31-.333.035-.767.03-1.294.025A62.136 62.136 0 0 0 12.002 3c-.84 0-1.514.03-1.974.05h-.016Zm1.98 2.54c-1.92 0-3.73.75-5.09 2.11a7.157 7.157 0 0 0-2.11 5.09c0 1.92.75 3.73 2.11 5.09a7.156 7.156 0 0 0 5.09 2.11c1.92 0 3.73-.75 5.09-2.11a7.157 7.157 0 0 0 2.11-5.09c0-1.92-.75-3.73-2.11-5.09a7.157 7.157 0 0 0-5.09-2.11Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.663 10.486a.325.325 0 0 0-.041.128c-.066.49-.122 1.128-.122 1.886v.002c-.002.63.04 1.26.122 1.885a.322.322 0 0 0 .04.126.09.09 0 0 0 .027.03.03.03 0 0 0 .016.005c.01 0 .04 0 .091-.02.425-.17 1.001-.43 1.757-.832l.003-.002a21.29 21.29 0 0 0 1.696-.994c.142-.093.15-.177.15-.2 0-.023-.008-.107-.15-.2-.427-.28-.985-.617-1.699-.996a18.05 18.05 0 0 0-1.757-.832.215.215 0 0 0-.092-.02.03.03 0 0 0-.015.004.09.09 0 0 0-.026.03Zm.873-1.872c-.643-.257-1.335-.208-1.9.142-.558.346-.906.93-.996 1.588-.077.572-.14 1.3-.14 2.155v-.001l1 .002h-1v-.001c-.002.72.045 1.44.14 2.153v.004c.09.657.438 1.242.996 1.588.565.35 1.257.398 1.9.142.502-.2 1.145-.493 1.954-.923a23.458 23.458 0 0 0 1.854-1.087l.003-.002c.66-.433 1.054-1.123 1.054-1.874 0-.75-.393-1.44-1.054-1.873-.48-.315-1.09-.682-1.856-1.09-.81-.43-1.452-.722-1.955-.923Z"
    />
  </ActionGlyph>
);

const RecordClipGlyph = () => (
  <ActionGlyph>
    <path d="M21 11.997c0-1.496-.11-2.741-.22-3.607-.012-.1-.06-.152-.093-.173a.113.113 0 0 0-.048-.018.14.14 0 0 0-.067.011c-1.342.513-2.575 1.24-3.512 1.873a1 1 0 0 1-1.56-.793 93.589 93.589 0 0 0-.117-2.664c-.05-.668-.494-1.134-1.05-1.225-1.14-.185-2.862-.38-5.06-.38-2.199 0-3.92.195-5.061.38-.556.091-.999.557-1.049 1.225C3.081 7.717 3 9.833 3 11.997c0 2.165.081 4.327.163 5.418.05.668.493 1.134 1.049 1.225 1.14.185 2.862.38 5.06.38 2.199 0 3.92-.195 5.061-.38.556-.09 1-.557 1.05-1.225.042-.566.085-1.812.117-2.71l.014-.135a1 1 0 0 1 1.546-.659c.937.634 2.17 1.36 3.512 1.873a.14.14 0 0 0 .067.01.113.113 0 0 0 .049-.017c.033-.02.08-.072.092-.172.11-.867.22-2.112.22-3.608Zm2 0a31.09 31.09 0 0 1-.235 3.858c-.172 1.362-1.526 2.324-2.906 1.797a17.885 17.885 0 0 1-2.426-1.158c-.008.174-.014.342-.022.497l-.034.573c-.113 1.513-1.18 2.798-2.723 3.05-1.235.2-3.065.406-5.382.406-2.316 0-4.146-.206-5.381-.407-1.542-.251-2.609-1.536-2.722-3.049C1.083 16.412 1 14.197 1 11.997s.083-4.367.169-5.52c.113-1.513 1.18-2.798 2.722-3.05 1.235-.2 3.065-.406 5.381-.406 2.317 0 4.147.206 5.382.407 1.543.25 2.61 1.536 2.723 3.049.02.255.037.62.055 1.023a17.9 17.9 0 0 1 2.427-1.158c1.38-.527 2.734.435 2.906 1.797.118.935.235 2.265.235 3.858Z" />
  </ActionGlyph>
);

const CreateDocGlyph = () => (
  <ActionGlyph>
    <path d="m19.163 10.635-.018-1.233a1.386 1.386 0 0 0-.062-.395l-.042-.109a10.652 10.652 0 0 0-1.933-2.823l-.221-.228a10.852 10.852 0 0 0-2.848-2.057l-.256-.12a1.126 1.126 0 0 0-.346-.088l-.138-.008A86.04 86.04 0 0 0 12 3.564c-1.93 0-3.484.062-4.663.138l-1.054.078a1.318 1.318 0 0 0-1.21 1.11l-.015.124c-.11 1.382-.228 3.646-.228 6.983 0 3.337.118 5.602.228 6.983l.015.124c.102.61.582 1.056 1.21 1.11l1.054.079A73.11 73.11 0 0 0 12 20.43c2.572 0 4.478-.11 5.717-.216l.124-.016a1.318 1.318 0 0 0 1.101-1.218l.082-1.205a101.1 101.1 0 0 0 .146-5.778c0-.476-.003-.93-.007-1.362Zm1.667 1.362c0 2.531-.067 4.463-.148 5.874l-.085 1.24a2.978 2.978 0 0 1-2.465 2.721l-.274.036c-1.285.11-3.238.222-5.858.222-1.965 0-3.555-.063-4.77-.141l-1.088-.081a2.978 2.978 0 0 1-2.705-2.484l-.034-.273c-.113-1.43-.233-3.739-.233-7.114 0-3.376.12-5.684.233-7.114l.034-.273a2.978 2.978 0 0 1 2.705-2.484l1.088-.08A74.668 74.668 0 0 1 12 1.903c.462 0 .903.003 1.323.01l.28.016c.283.029.575.097.858.224l.307.143a12.51 12.51 0 0 1 3.293 2.376l.253.261a12.307 12.307 0 0 1 2.237 3.275l.06.144c.131.338.186.685.193 1.014l.02 1.252c.004.438.006.897.006 1.378Z" />
    <path d="M13.65 2.21a.831.831 0 0 1 .793-.065c.728.324 2.174 1.085 3.618 2.528l.262.27a12.262 12.262 0 0 1 2.265 3.347l.037.098a.832.832 0 0 1-.804 1.07 37.54 37.54 0 0 1-2.592-.139l-.828-.074a3.227 3.227 0 0 1-2.872-2.626l-.04-.286a52.57 52.57 0 0 1-.19-2.586l-.023-.834a.831.831 0 0 1 .374-.702Zm1.345 2.119c.039.626.091 1.269.146 1.847l.02.14c.127.686.69 1.21 1.397 1.277l.813.072c.34.028.689.052 1.033.073a11.116 11.116 0 0 0-1.288-1.655l-.23-.236a11.14 11.14 0 0 0-1.891-1.518Zm1.215 8.366.085.004a.83.83 0 0 1 0 1.652l-.085.004H7.79a.83.83 0 0 1 0-1.66h8.42Zm0 3.478.085.004a.83.83 0 0 1 0 1.652l-.085.004H7.79a.83.83 0 0 1 0-1.66h8.42ZM12 9.186l.085.004a.83.83 0 0 1 0 1.652l-.085.004H8.001a.83.83 0 1 1 0-1.66h4Z" />
  </ActionGlyph>
);

const CreateWhiteboardGlyph = () => (
  <ActionGlyph>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.966 2.355c-4.098-.307-9.857-.307-13.95.002a2.878 2.878 0 0 0-2.66 2.66c-.308 4.098-.308 9.868 0 13.967a2.878 2.878 0 0 0 2.66 2.66c4.1.308 9.869.308 13.968 0a2.88 2.88 0 0 0 2.66-2.66c.311-4.062.308-9.606-.009-13.946a2.893 2.893 0 0 0-2.67-2.683Zm-13.8 1.996c3.993-.3 9.652-.301 13.65-.001a.893.893 0 0 1 .825.834c.31 4.247.312 9.69.01 13.648a.88.88 0 0 1-.817.817c-4 .301-9.669.301-13.668 0a.878.878 0 0 1-.815-.816c-.301-3.998-.301-9.668 0-13.667a.878.878 0 0 1 .815-.815Zm5.322 2.825a1 1 0 0 0-1.413.028l.72.693-.72-.693-.002.001-.003.003-.01.01-.035.037-.124.135c-.106.115-.254.28-.427.48-.343.398-.794.95-1.207 1.55-.403.585-.814 1.28-1.025 1.953-.197.63-.325 1.626.462 2.33.79.708 1.748.52 2.38.275.607-.236 1.245-.647 1.771-.986l.081-.053c.603-.388 1.065-.675 1.438-.806a1.2 1.2 0 0 1 .17-.048.95.95 0 0 1-.028.108c-.088.273-.285.607-.57 1.064l-.053.084c-.24.384-.55.88-.716 1.355a2.202 2.202 0 0 0-.128.98c.047.4.23.769.548 1.058.328.3.719.456 1.132.478a2.33 2.33 0 0 0 1.018-.2c.507-.213 1.019-.586 1.415-.875l.067-.049c.468-.34.803-.573 1.077-.682a.78.78 0 0 1 .122-.04 1 1 0 0 0 1.302-1.517c-.724-.648-1.566-.54-2.165-.301-.54.215-1.074.604-1.481.9l-.031.023c-.35.254-.622.45-.85.581.104-.197.252-.435.44-.736l.008-.013c.254-.408.592-.95.768-1.494.189-.584.256-1.39-.348-2.078a1.874 1.874 0 0 0-1.202-.64c-.425-.05-.826.039-1.157.155-.631.221-1.294.648-1.833.995l-.026.017c-.604.389-1.085.697-1.492.855a1.397 1.397 0 0 1-.265.078 1.48 1.48 0 0 1 .054-.22c.12-.386.397-.884.765-1.417.357-.519.758-1.012 1.074-1.379a18.652 18.652 0 0 1 .493-.55l.027-.028.006-.006.001-.001a1 1 0 0 0-.027-1.414Z"
    />
  </ActionGlyph>
);

const CreateDashboardGlyph = () => (
  <ActionGlyph>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.172 2.234C6.585 2.12 8.82 2 12 2c3.181 0 5.416.12 6.828.234a3.182 3.182 0 0 1 2.938 2.938C21.88 6.585 22 8.82 22 12c0 3.181-.12 5.416-.234 6.828a3.182 3.182 0 0 1-2.938 2.938C17.416 21.88 15.18 22 12 22c-3.181 0-5.415-.12-6.828-.234a3.182 3.182 0 0 1-2.938-2.938C2.12 17.416 2 15.18 2 12c0-3.181.12-5.415.234-6.828a3.182 3.182 0 0 1 2.938-2.938ZM12 4c-3.131 0-5.311.118-6.666.228-.607.049-1.057.5-1.106 1.106C4.118 6.69 4 8.87 4 12c0 3.131.118 5.311.228 6.666.049.607.5 1.057 1.106 1.106C6.689 19.882 8.87 20 12 20c3.131 0 5.311-.118 6.666-.228.607-.049 1.057-.5 1.106-1.106C19.882 17.31 20 15.13 20 12c0-3.131-.118-5.311-.228-6.666a1.183 1.183 0 0 0-1.106-1.106C17.31 4.118 15.13 4 12 4Z"
    />
    <path d="M8.339 12.018c.382.03.624.356.635.74.012.424.024 1.076.024 1.988 0 .912-.012 1.564-.024 1.989-.011.383-.253.709-.635.74a4.685 4.685 0 0 1-.738 0c-.382-.031-.624-.357-.635-.74a70.068 70.068 0 0 1-.025-1.989c0-.912.013-1.564.025-1.989.01-.383.253-.709.635-.74a4.685 4.685 0 0 1 .738 0ZM15.55 7.037c-.351.064-.56.542-.569 1.086-.013.787-.03 2.13-.03 4.122 0 1.991.017 3.334.03 4.121.01.544.218 1.022.57 1.086.12.022.263.036.428.036.164 0 .306-.014.427-.036.352-.064.56-.542.57-1.086.013-.787.029-2.13.029-4.121 0-1.992-.016-3.335-.03-4.122-.009-.544-.217-1.022-.569-1.086a2.387 2.387 0 0 0-.427-.036c-.165 0-.307.014-.428.036ZM12.5 9.657a.538.538 0 0 1 .448.537c.015.529.036 1.611.036 3.356 0 1.746-.021 2.828-.036 3.357a.538.538 0 0 1-.448.537 2.904 2.904 0 0 1-.525.044c-.212 0-.386-.018-.525-.044a.538.538 0 0 1-.448-.537c-.015-.529-.036-1.611-.036-3.357 0-1.745.021-2.827.036-3.357a.538.538 0 0 1 .448-.536 2.9 2.9 0 0 1 .525-.044 2.9 2.9 0 0 1 .525.044Z" />
  </ActionGlyph>
);

/**
 * Global top bar — full width, h=40px.
 *
 * Oracle measurements (from getComputedStyle on localhost:7050):
 *   Height: 40px
 *   Background: white (body bg rgb(255,255,255))
 *   Layout:
 *     Left: workspace picker button (x=6, y=6, w=234, h=28) with rgba(0,0,0,0.06) bg
 *     Center: search button (x=577, y=6, w=286, h=28) white bg
 *     Right: action icons (x≈1256–1384, each 24×24 at y=8) + avatar (x=1390, w=44, h=32)
 */

function ActionButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'var(--cu-text-muted)',
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-hover)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--cu-text-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--cu-text-muted)';
      }}
    >
      {children}
    </button>
  );
}

export function TopBar() {
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const openSearch = useUiStore((s) => s.openSearch);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  return (
    // cu-home-top-bar matches ClickUp's top bar element class (border-bottom, h=44px from computed)
    <header
      aria-label="Top bar"
      className="cu-home-top-bar"
      style={{
        height: 40,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--cu-bg-topbar)',
        width: '100%',
        paddingLeft: 6,
        paddingRight: 6,
        gap: 0,
        position: 'relative',
        borderBottom: '1px solid var(--cu-border)',
      }}
    >
      {/* Left: Workspace picker */}
      <button
        aria-label="Workspace menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          paddingLeft: 8,
          paddingRight: 8,
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--cu-text-primary)',
          fontSize: 13,
          fontWeight: 450,
          flexShrink: 0,
          maxWidth: 234,
          minWidth: 140,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
        }}
      >
        {/* Workspace tile — oracle uses a rounded-square (squircle) tile in
            teal-green rgb(18,165,148), not a circle. */}
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: 'rgb(18, 165, 148)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 10,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          C
        </span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          Cameron Mc's Workspace
        </span>
        <ChevronDownIcon size={14} />
      </button>

      {/* Spacer to push search toward center */}
      <div style={{ flex: 1 }} />

      {/* Center: Search button */}
      <button
        aria-label="Search"
        onClick={() => openSearch()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 28,
          width: 286,
          paddingLeft: 10,
          paddingRight: 10,
          background: 'var(--cu-bg-input)',
          border: '1px solid var(--cu-border)',
          borderRadius: 8,
          cursor: 'pointer',
          color: 'var(--cu-text-muted)',
          fontSize: 13,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-hover)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cu-border-strong)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-input)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cu-border)';
        }}
      >
        <SearchIcon size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search</span>
        <kbd
          style={{
            fontSize: 11,
            color: 'var(--cu-text-disabled)',
            fontFamily: 'inherit',
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          ⌘K
        </kbd>
        {/* AI mark — oracle shows a soft multi-lobe flower burst (blended blue→pink→orange,
            subtle/desaturated, not hard sparkles). Built from six rounded petals around a centre. */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 4 }}>
          <g style={{ mixBlendMode: 'normal' }}>
            <ellipse cx="8" cy="3.6" rx="2" ry="2.6" fill="#5B9BF0" opacity="0.85" />
            <ellipse cx="11.8" cy="6" rx="2" ry="2.6" transform="rotate(60 11.8 6)" fill="#C06AD6" opacity="0.8" />
            <ellipse cx="11.8" cy="10.4" rx="2" ry="2.6" transform="rotate(120 11.8 10.4)" fill="#E879A9" opacity="0.8" />
            <ellipse cx="8" cy="12.6" rx="2" ry="2.6" fill="#F0935B" opacity="0.82" />
            <ellipse cx="4.2" cy="10.4" rx="2" ry="2.6" transform="rotate(60 4.2 10.4)" fill="#F2B25C" opacity="0.78" />
            <ellipse cx="4.2" cy="6" rx="2" ry="2.6" transform="rotate(120 4.2 6)" fill="#7FB3E8" opacity="0.78" />
            <circle cx="8" cy="8" r="2.2" fill="#FFFFFF" opacity="0.55" />
          </g>
        </svg>
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: Action icon buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <ActionButton label="Create task" onClick={() => openCreateTask()}>
          <CreateTaskGlyph />
        </ActionButton>
        <ActionButton label="Track Time">
          <TrackTimeGlyph />
        </ActionButton>
        <ActionButton label="Record a Clip">
          <RecordClipGlyph />
        </ActionButton>
        <ActionButton label="Create Doc">
          <CreateDocGlyph />
        </ActionButton>
        <ActionButton label="Create Whiteboard">
          <CreateWhiteboardGlyph />
        </ActionButton>
        <ActionButton label="Create Dashboard">
          <CreateDashboardGlyph />
        </ActionButton>

        {/* Avatar with dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setUserMenuOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            height: 32,
            paddingLeft: 4,
            paddingRight: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 6,
            marginLeft: 2,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {/* Avatar circle with online indicator */}
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgb(92, 71, 205)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              CM
            </span>
            {/* Online dot */}
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'rgb(44, 140, 94)',
                border: '1.5px solid var(--cu-bg-topbar)',
              }}
            />
          </span>
          <ChevronDownIcon size={12} style={{ color: 'var(--cu-text-muted)' }} />
        </button>

        {userMenuOpen && <UserMenu onClose={() => setUserMenuOpen(false)} />}
        </div>
      </div>

      <CommandPalette />
    </header>
  );
}
