import { memo } from 'react';
import { Minus, Square, X, type LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import * as icons from 'lucide-react';

interface TitleBarProps {
  windowId: string;
  title: string;
  icon?: string;
  isFocused: boolean;
  onMouseDown: () => void;
}

export const TitleBar = memo(function TitleBar({
  windowId,
  title,
  icon,
  isFocused,
  onMouseDown,
}: TitleBarProps) {
  const minimizeWindow = useOSStore((s) => s.minimizeWindow);
  const maximizeWindow = useOSStore((s) => s.maximizeWindow);
  const closeWindow = useOSStore((s) => s.closeWindow);

  const IconComp = icon ? (icons[icon as keyof typeof icons] as LucideIcon | undefined) : undefined;

  return (
    <div
      className="h-9 flex items-center justify-between select-none cursor-default rounded-t-3xl overflow-hidden"
      style={{ background: 'transparent' }}
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center gap-2 px-4" style={{ color: '#2D2B55' }}>
        {IconComp && <IconComp className="w-4 h-4" style={{ color: '#2D2B55' }} />}
        <span className="text-sm font-semibold truncate max-w-[200px]">{title}</span>
      </div>
      <div className="flex items-center gap-1.5 pr-3">
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'rgba(45,43,85,0.08)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,43,85,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(45,43,85,0.08)')}
          onClick={() => minimizeWindow(windowId)}
          aria-label="Minimize"
        >
          <Minus className="w-3 h-3" style={{ color: '#2D2B55' }} />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'rgba(45,43,85,0.08)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45,43,85,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(45,43,85,0.08)')}
          onClick={() => maximizeWindow(windowId)}
          aria-label="Maximize"
        >
          <Square className="w-3 h-3" style={{ color: '#2D2B55' }} />
        </button>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ background: 'rgba(232,93,93,0.15)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(232,93,93,0.35)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(232,93,93,0.15)')}
          onClick={() => closeWindow(windowId)}
          aria-label="Close"
        >
          <X className="w-3 h-3" style={{ color: '#E85D5D' }} />
        </button>
      </div>
    </div>
  );
});
