'use client';

import * as Switch from '@radix-ui/react-switch';

/**
 * Control widgets unique to the Workspace Settings pane: the workspace toggle
 * (off #2a2a2a / on #3e63dd), disabled-look "Add" logo button, the colour
 * scheme swatch row, the custom-URL input with a static suffix, and the
 * rounded-square workspace avatar.
 */

export function WorkspaceToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="
        w-9 h-5 rounded-full relative cursor-pointer shrink-0 transition-colors
        bg-[#3e63dd] data-[state=unchecked]:bg-[#2a2a2a]
      "
    >
      <Switch.Thumb
        className="
          block w-4 h-4 rounded-full bg-white shadow-sm
          translate-x-0.5 data-[state=checked]:translate-x-[18px]
          transition-transform
        "
      />
    </Switch.Root>
  );
}

export function AddLogoButton() {
  return (
    <button
      type="button"
      disabled
      className="
        rounded-[6px] text-[13px] font-medium px-3.5 py-1
        bg-[#2a2a2a] text-[#b4b4b4] cursor-not-allowed opacity-80
      "
    >
      Add
    </button>
  );
}

export function WorkspaceAvatar() {
  return (
    <span
      className="
        w-9 h-9 rounded-[10px] flex items-center justify-center
        text-white text-[15px] font-semibold select-none
      "
      style={{ background: '#12A594' }}
    >
      C
    </span>
  );
}

const EyedropperGlyph = (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m2 22 1-1h3l9-9" />
    <path d="M3 21v-3l9-9" />
    <path d="m15 6 3.4-3.4a2.1 2.1 0 0 1 3 3L18 9l-3-3Z" />
  </svg>
);

export function ColorSchemeRow({
  colors,
  selected,
  onSelect,
}: {
  colors: readonly string[];
  selected: string;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {colors.map((c) => {
        const isSelected = c === selected;
        return (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => onSelect(c)}
            className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110"
            style={{
              background: c,
              boxShadow: isSelected ? '0 0 0 2px #1a1a1a, 0 0 0 4px #ffffff' : 'none',
            }}
          />
        );
      })}
      <button
        type="button"
        aria-label="Custom colour"
        className="ml-1 w-5 h-5 flex items-center justify-center text-[#7b7b7b] hover:text-white transition-colors"
      >
        {EyedropperGlyph}
      </button>
    </div>
  );
}

export function CustomUrlField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        placeholder="app"
        onChange={(e) => onChange(e.target.value)}
        className="
          w-[120px] h-8 px-2.5 rounded-[6px] text-[13px] text-white
          bg-[#2a2a2a] border border-[#2a2a2a]
          placeholder:text-[#7b7b7b] focus:outline-none focus:border-[#3e63dd]
          transition-colors
        "
      />
      <span className="text-[13px] text-[#7b7b7b]">.clickup.com</span>
    </div>
  );
}
