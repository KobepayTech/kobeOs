import { useRef, useCallback, type ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { TitleBar } from './TitleBar';
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
    (e: React.MouseEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
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

      const onMove = (ev: MouseEvent) => {
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
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
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
        let nx = state.startWinX;
        let ny = state.startWinY;
        let nw = state.startW;
        let nh = state.startH;
        const minW = win.minWidth;
        const minH = win.minHeight;
        if (state.dir.includes('e')) nw = Math.max(minW, state.startW + dx);
        if (state.dir.includes('w')) {
          nw = Math.max(minW, state.startW - dx);
          nx = state.startWinX + (state.startW - nw);
        }
        if (state.dir.includes('s')) nh = Math.max(minH, state.startH + dy);
        if (state.dir.includes('n')) {
          nh = Math.max(minH, state.startH - dy);
          ny = state.startWinY + (state.startH - nh);
        }
        nw = Math.min(nw, vw);
        nh = Math.min(nh, vh);
        updateWindow(win.id, { x: nx, y: ny, width: nw, height: nh });
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

  if (win.isMinimized) return null;

  const isMax = win.isMaximized;
  const style = isMax
    ? {
        left: 0,
        top: 0,
        width: '100%' as const,
        height: 'calc(100% - 48px)' as const,
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
      className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08]"
      style={{
        ...style,
        zIndex: win.zIndex,
        background: 'rgba(30,41,59,0.98)',
        boxShadow: win.isFocused
          ? '0 35px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.3)'
          : '0 25px 50px -12px rgba(0,0,0,0.5)',
      }}
      onMouseDown={onMouseDownWindow}
    >
      <div onMouseDown={startDrag}>
        <TitleBar
          windowId={win.id}
          title={win.title}
          icon={win.icon}
          isFocused={win.isFocused}
          onMouseDown={() => {}}
        />
      </div>
      <div className="flex-1 overflow-auto" onMouseDown={(e) => e.stopPropagation()}>
        {children}
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
