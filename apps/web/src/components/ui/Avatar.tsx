import * as RadixAvatar from '@radix-ui/react-avatar';

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: 'xs' | 'sm' | 'md';
}

const sizeMap = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-[11px]',
  md: 'w-7 h-7 text-xs',
};

export function Avatar({ src, fallback, size = 'sm' }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={`
        ${sizeMap[size]} inline-flex items-center justify-center
        rounded-full overflow-hidden shrink-0
        bg-[var(--cu-accent)] text-white font-medium select-none
      `}
    >
      <RadixAvatar.Image
        src={src}
        alt={fallback}
        className="w-full h-full object-cover"
      />
      <RadixAvatar.Fallback className="flex items-center justify-center w-full h-full">
        {fallback.slice(0, 2).toUpperCase()}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}
