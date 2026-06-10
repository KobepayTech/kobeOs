import { memo } from 'react';
import { Minus, Maximize2, X, type LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import * as icons from 'lucide-react';

interface TitleBarProps {
  windowId: string;
  title: string;
  icon?: string;
  isFocused: boolean;
  onMouseDown: () => void;
}

/* ── macOS Traffic Light colors ───────────────────────────────────── */
const TRAFFIC_LIGHT = {
  close:   { bg: '#FF5F57', border: '#E0443E', hover: '#FF5F57' },
  minimize:{ bg: '#FFBD2E', border: '#D19A1D', hover: '#FFBD2E' },
  maximize:{ bg: '#28C840', border: '#1BAC2C', hover: '#28C840' },
} as const;

export const TitleBar = memo(function TitleBar({
  windowId,
  title,
  icon,
  isFocused,
  onMouseDown,
}: TitleBarProps) {
  const minimizeWindow = useOSStore((s) => s.minimizeWindow);
  const maximizeWindow = useOSStore((s) => s.maximizeWindow);
  const closeWindow    = useOSStore((s) => s.closeWindow);

  const IconComp = icon
    ? (icons[icon as keyof typeof icons] as LucideIcon | undefined)
    : undefined;

  /* Dim the lights when window is not focused (macOS behaviour) */
  const dim = !isFocused;

  return (
    <div
      className="h-9 flex items-center select-none cursor-default rounded-t-3xl overflow-hidden relative"
      style={{ background: 'transparent' }}
      onMouseDown={onMouseDown}
    >
      {/* ── Traffic lights (LEFT, macOS style) ── */}
      <div className="flex items-center gap-2 pl-4 pr-3 z-10">
        {/* Close */}
        <button
          className="group relative flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: 12,
            height: 12,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.close.bg,
            border: `0.5px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.close.border}`,
          }}
          onClick={() => closeWindow(windowId)}
          aria-label="Close"
        >
          <X
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{
              width: 8,
              height: 8,
              color: '#4D0000',
              strokeWidth: 3,
            }}
          />
        </button>

        {/* Minimize */}
        <button
          className="group relative flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: 12,
            height: 12,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.minimize.bg,
            border: `0.5px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.minimize.border}`,
          }}
          onClick={() => minimizeWindow(windowId)}
          aria-label="Minimize"
        >
          <Minus
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{
              width: 8,
              height: 8,
              color: '#995700',
              strokeWidth: 3,
            }}
          />
        </button>

        {/* Maximize */}
        <button
          className="group relative flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: 12,
            height: 12,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.maximize.bg,
            border: `0.5px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.maximize.border}`,
          }}
          onClick={() => maximizeWindow(windowId)}
          aria-label="Maximize"
        >
          <Maximize2
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{
              width: 8,
              height: 8,
              color: '#006500',
              strokeWidth: 3,
            }}
          />
        </button>
      </div>

      {/* ── Title (CENTERED) ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2">
          {IconComp && (
            <IconComp
              className="w-3.5 h-3.5"
              style={{ color: 'var(--os-text-secondary)' }}
            />
          )}
          <span
            className="text-xs font-medium truncate max-w-[240px]"
            style={{ color: 'var(--os-text-secondary)' }}
          >
            {title}
          </span>
        </div>
      </div>
    </div>
  );
});
