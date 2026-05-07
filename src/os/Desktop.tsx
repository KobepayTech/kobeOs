import { useCallback } from 'react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useOSStore } from './store';
import { ContextMenu } from './ContextMenu';

/**
 * Desktop background and icon grid.
 */
export function Desktop() {
  const {
    settings,
    selectedIconId,
    selectIcon,
    deselectIcon,
    showContextMenu,
    hideContextMenu,
    contextMenu,
    launchApp,
  } = useOSStore();

  const iconsList = settings.desktopIcons;

  const handleBgClick = useCallback(() => {
    deselectIcon();
    hideContextMenu();
  }, [deselectIcon, hideContextMenu]);

  const handleBgRightClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        {
          id: 'new-folder',
          label: 'New Folder',
          icon: 'FolderPlus',
          action: () => {
            // Folder creation stub — could expand store later
          },
        },
        {
          id: 'new-doc',
          label: 'New Document',
          icon: 'FilePlus',
          action: () => {},
        },
        {
          id: 'sep1',
          label: '',
          action: () => {},
          separator: true,
        },
        {
          id: 'refresh',
          label: 'Refresh',
          icon: 'RefreshCw',
          action: () => {
            window.location.reload();
          },
        },
        {
          id: 'sep2',
          label: '',
          action: () => {},
          separator: true,
        },
        {
          id: 'display',
          label: 'Display Settings',
          icon: 'Monitor',
          action: () => launchApp('settings'),
        },
      ]);
    },
    [showContextMenu, launchApp]
  );

  return (
    <div
      className="absolute inset-0"
      style={{
        background: settings.wallpaper,
        bottom: 48,
      }}
      onClick={handleBgClick}
      onContextMenu={handleBgRightClick}
    >
      {iconsList.map((icon) => {
        const Icon = (icons[icon.icon as keyof typeof icons] as LucideIcon | undefined) ?? icons.File;
        const isSelected = selectedIconId === icon.id;
        return (
          <div
            key={icon.id}
            className="absolute flex flex-col items-center gap-1 cursor-pointer group"
            style={{ left: icon.x, top: icon.y, width: 72 }}
            onClick={(e) => {
              e.stopPropagation();
              selectIcon(icon.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              launchApp(icon.appId);
            }}
          >
            <div
              className="w-16 h-16 flex items-center justify-center rounded-xl transition-all group-hover:scale-105"
              style={{
                background: isSelected
                  ? 'rgba(59,130,246,0.25)'
                  : 'rgba(255,255,255,0.08)',
                border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Icon className="w-8 h-8 text-os-text-primary" />
            </div>
            <span
              className="text-[11px] text-center leading-tight font-medium px-1 rounded"
              style={{
                color: '#f8fafc',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                background: isSelected ? 'rgba(59,130,246,0.5)' : 'transparent',
              }}
            >
              {icon.label}
            </span>
          </div>
        );
      })}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}
