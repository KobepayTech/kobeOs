import { useRef, useCallback, type ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { TitleBar } from './TitleBar';
import { AppFooter } from './AppFooter';
import { useOSStore } from './store';
import type { WindowInstance } from './types';

interface AppWindowProps {
  window: WindowInstance;
  children: ReactNode;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const AppWindow = memo(function AppWindow({ window: win, children }: AppWindowProps) {
  const bringToFront = useOSStore((s) => s.bringToFront);
  const updateWindow = useOSStore((s) => s.updateWindow);
  const focusWindow = useOSStore((s) => s.focusWindow);

  const dragState = useRef({
    dragging: false,
    resizing: false,
    startX: 0,
    startY: 0,
    startWinX: 0,
    startWinY: 0,
    startW: 0,
    startH: 0,
    dir: '' as ResizeDir,
  });

  const onMouseDownWindow = useCallback(() => {
    if (!win.isFocused) focusWindow(win.id);
  }, [win.id, win.isFocused, focusWindow]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      bringToFront(win.id);
      dragState.current = {
        dragging: true,
        resizing: false,
        startX: e.clientX,
        startY: e.clientY,
        startWinX: win.x,
        startWinY: win.y,
        startW: win.width,
        startH: win.height,
        dir: '' as ResizeDir,
      };

      const onMove = (ev: PointerEvent) => {
        const state = dragState.current;
        if (!state.dragging) return;
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let nx = state.startWinX + dx;
        let ny = state.startWinY + dy;
        nx = Math.max(0, Math.min(nx, vw - win.width));
        ny = Math.max(0, Math.min(ny, vh - win.height));
        updateWindow(win.id, { x: nx, y: ny });
      };

      const onUp = () => {
        dragState.current.dragging = false;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [win.id, win.x, win.y, win.width, win.height, win.isMaximized, bringToFront, updateWindow]
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent, dir: ResizeDir) => {
      if (win.isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      bringToFront(win.id);
      dragState.current = {
        dragging: false,
        resizing: true,
        startX: e.clientX,
        startY: e.clientY,
        startWinX: win.x,
        startWinY: win.y,
        startW: win.width,
        startH: win.height,
        dir,
      };

      const onMove = (ev: MouseEvent) => {
        const state = dragState.current;
        if (!state.resizing) return;
        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const minW = Math.min(win.minWidth, vw);
        const minH = Math.min(win.minHeight, vh);
        let left = Math.max(0, Math.min(state.startWinX, Math.max(0, vw - minW)));
        let top = Math.max(0, Math.min(state.startWinY, Math.max(0, vh - minH)));
        let right = Math.max(left + minW, Math.min(vw, state.startWinX + state.startW));
        let bottom = Math.max(top + minH, Math.min(vh, state.startWinY + state.startH));

        if (state.dir.includes('e')) {
          right = Math.max(left + minW, Math.min(vw, state.startWinX + state.startW + dx));
        }
        if (state.dir.includes('w')) {
          left = Math.max(0, Math.min(right - minW, state.startWinX + dx));
        }
        if (state.dir.includes('s')) {
          bottom = Math.max(top + minH, Math.min(vh, state.startWinY + state.startH + dy));
        }
        if (state.dir.includes('n')) {
          top = Math.max(0, Math.min(bottom - minH, state.startWinY + dy));
        }
        updateWindow(win.id, {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        });
      };

      const onUp = () => {
        dragState.current.resizing = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [win.id, win.x, win.y, win.width, win.height, win.minWidth, win.minHeight, win.isMaximized, bringToFront, updateWindow]
  );

  const isMax = win.isMaximized;
  const style = isMax
    ? {
        left: 0,
        top: 0,
        width: '100%' as const,
        height: '100%' as const,
        position: 'absolute' as const,
      }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        position: 'absolute' as const,
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      aria-hidden={win.isMinimized}
      className={`flex flex-col overflow-hidden border border-white/50 pointer-events-auto ${isMax ? 'rounded-none' : 'rounded-3xl'}`}
      style={{
        ...style,
        display: win.isMinimized ? 'none' : 'flex',
        zIndex: win.zIndex,
        background: 'rgba(255,255,255,0.40)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        boxShadow: win.isFocused
          ? '0 25px 80px rgba(123,140,222,0.20)'
          : '0 20px 60px rgba(123,140,222,0.12)',
      }}
      onMouseDown={onMouseDownWindow}
    >
      <div
        className="touch-none select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          startDrag(e);
        }}
      >
        <TitleBar
          windowId={win.id}
          title={win.title}
          icon={win.icon}
          isFocused={win.isFocused}
          isMaximized={win.isMaximized}
          onMouseDown={() => {}}
        />
      </div>
      {/* Scroll area: every module scrolls vertically and always ends at the
          shared footer (Contact us · © KobeOS <year>). The min-h-full column
          keeps the footer pinned to the bottom for short apps and pushes it
          below the fold for tall/full-height ones. */}
      <div className="flex-1 overflow-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex min-h-full flex-col">
          <div className="flex-1">{children}</div>
          <AppFooter />
        </div>
      </div>

      {!isMax && (
        <>
          {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeDir[]).map((dir) => {
            const cursorMap: Record<ResizeDir, string> = {
              n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
              ne: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize', sw: 'nesw-resize',
            };
            const posMap: Record<ResizeDir, React.CSSProperties> = {
              n: { top: -4, left: 8, right: 8, height: 8 },
              s: { bottom: -4, left: 8, right: 8, height: 8 },
              e: { right: -4, top: 8, bottom: 8, width: 8 },
              w: { left: -4, top: 8, bottom: 8, width: 8 },
              ne: { top: -4, right: -4, width: 12, height: 12 },
              nw: { top: -4, left: -4, width: 12, height: 12 },
              se: { bottom: -4, right: -4, width: 12, height: 12 },
              sw: { bottom: -4, left: -4, width: 12, height: 12 },
            };
            return (
              <div
                key={dir}
                className="absolute z-10"
                style={{ ...posMap[dir], cursor: cursorMap[dir] }}
                onMouseDown={(e) => onResizeStart(e, dir)}
              />
            );
          })}
        </>
      )}
    </motion.div>
  );
});
