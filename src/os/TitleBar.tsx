import { memo, type MouseEvent } from 'react';
import { Minus, Maximize2, Minimize2, X, type LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import * as icons from 'lucide-react';

interface TitleBarProps {
  windowId: string;
  title: string;
  icon?: string;
  isFocused: boolean;
  isMaximized: boolean;
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
  isMaximized,
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
  const MaximizeIcon = isMaximized ? Minimize2 : Maximize2;

  const stopControlMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    // Do not let a window-control click start a title-bar drag.
    event.stopPropagation();
  };

  return (
    <div
      className="h-11 flex items-center select-none cursor-grab active:cursor-grabbing rounded-t-3xl overflow-hidden relative"
      style={{ background: 'transparent' }}
      onMouseDown={onMouseDown}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        maximizeWindow(windowId);
      }}
    >
      {/* ── Traffic lights (LEFT, macOS-style with always-visible glyphs) ── */}
      <div className="flex items-center gap-2.5 pl-4 pr-3 z-10">
        {/* Close */}
        <button
          type="button"
          className="group relative flex items-center justify-center rounded-full transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            width: 22,
            height: 22,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.close.bg,
            border: `1px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.close.border}`,
          }}
          onMouseDown={stopControlMouseDown}
          onClick={(event) => {
            event.stopPropagation();
            closeWindow(windowId);
          }}
          aria-label="Close window"
          title="Close"
        >
          <X
            style={{
              width: 13,
              height: 13,
              color: dim ? 'rgba(0,0,0,0.45)' : '#4D0000',
              strokeWidth: 3,
            }}
          />
        </button>

        {/* Minimize */}
        <button
          type="button"
          className="group relative flex items-center justify-center rounded-full transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            width: 22,
            height: 22,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.minimize.bg,
            border: `1px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.minimize.border}`,
          }}
          onMouseDown={stopControlMouseDown}
          onClick={(event) => {
            event.stopPropagation();
            minimizeWindow(windowId);
          }}
          aria-label="Minimize window"
          title="Minimize"
        >
          <Minus
            style={{
              width: 13,
              height: 13,
              color: dim ? 'rgba(0,0,0,0.45)' : '#995700',
              strokeWidth: 3,
            }}
          />
        </button>

        {/* Maximize / restore */}
        <button
          type="button"
          className="group relative flex items-center justify-center rounded-full transition-all duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            width: 22,
            height: 22,
            background: dim ? '#D3D3D3' : TRAFFIC_LIGHT.maximize.bg,
            border: `1px solid ${dim ? '#B0B0B0' : TRAFFIC_LIGHT.maximize.border}`,
          }}
          onMouseDown={stopControlMouseDown}
          onClick={(event) => {
            event.stopPropagation();
            maximizeWindow(windowId);
          }}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          title={isMaximized ? 'Restore' : 'Full screen'}
        >
          <MaximizeIcon
            style={{
              width: 12,
              height: 12,
              color: dim ? 'rgba(0,0,0,0.45)' : '#006500',
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
