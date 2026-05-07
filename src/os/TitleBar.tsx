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
      className="h-9 flex items-center justify-between select-none cursor-default rounded-t-xl overflow-hidden"
      style={{
        background: isFocused
          ? 'linear-gradient(90deg, #1e293b, #334155)'
          : 'linear-gradient(90deg, #1e293b, #1e293b)',
      }}
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center gap-2 px-3 text-os-text-primary">
        {IconComp && <IconComp className="w-4 h-4" />}
        <span className="text-sm font-semibold truncate max-w-[200px]">{title}</span>
      </div>
      <div className="flex items-center gap-1 pr-2">
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          onClick={() => minimizeWindow(windowId)}
          aria-label="Minimize"
        >
          <Minus className="w-3.5 h-3.5 text-os-text-secondary" />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          onClick={() => maximizeWindow(windowId)}
          aria-label="Maximize"
        >
          <Square className="w-3.5 h-3.5 text-os-text-secondary" />
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/80 transition-colors"
          onClick={() => closeWindow(windowId)}
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5 text-os-text-secondary" />
        </button>
      </div>
    </div>
  );
});
