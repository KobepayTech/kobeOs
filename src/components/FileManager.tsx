import { useState } from 'react';
import { Folder, FileText, Image, Music, Video, ChevronRight, Home, ArrowLeft, Grid, List } from 'lucide-react';

interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'image' | 'music' | 'video';
  size?: string;
  modified: string;
}

export default function FileManager() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPath, setCurrentPath] = useState('/home/kobeos');
  const [selected, setSelected] = useState<string | null>(null);

  const files: FileItem[] = [
    { name: 'Documents', type: 'folder', modified: '2026-05-13' },
    { name: 'Downloads', type: 'folder', modified: '2026-05-12' },
    { name: 'ERP-Reports', type: 'folder', modified: '2026-05-10' },
    { name: 'invoice-march.pdf', type: 'file', size: '2.4 MB', modified: '2026-03-15' },
    { name: 'logo.png', type: 'image', size: '156 KB', modified: '2026-04-20' },
    { name: 'meeting-recording.mp4', type: 'video', size: '45 MB', modified: '2026-05-01' },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder size={20} className="text-blue-400" />;
      case 'image': return <Image size={20} className="text-purple-400" />;
      case 'music': return <Music size={20} className="text-pink-400" />;
      case 'video': return <Video size={20} className="text-red-400" />;
      default: return <FileText size={20} className="text-gray-400" />;
    }
  };

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-800/50">
        <button className="p-1.5 hover:bg-gray-700 rounded-lg"><ArrowLeft size={16} /></button>
        <button className="p-1.5 hover:bg-gray-700 rounded-lg"><Home size={16} /></button>
        <div className="flex-1 flex items-center bg-gray-800 rounded-lg px-3 py-1 mx-2">
          <ChevronRight size={14} className="text-gray-500 mr-2" />
          <span className="text-xs text-gray-300">{currentPath}</span>
        </div>
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700' : ''}`}><List size={14} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700' : ''}`}><Grid size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 gap-0.5">
            {files.map(file => (
              <div key={file.name} onClick={() => setSelected(file.name)}
                onDoubleClick={() => file.type === 'folder' && setCurrentPath(`${currentPath}/${file.name}`)}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                  selected === file.name ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-800/50'
                }`}>
                {getIcon(file.type)}
                <div className="flex-1"><p className="text-sm">{file.name}</p><p className="text-xs text-gray-500">{file.modified}</p></div>
                {file.size && <span className="text-xs text-gray-500">{file.size}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 p-2">
            {files.map(file => (
              <div key={file.name} onClick={() => setSelected(file.name)}
                className={`flex flex-col items-center p-3 rounded-xl cursor-pointer transition-colors ${
                  selected === file.name ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-800/50'
                }`}>
                <div className="mb-2">{getIcon(file.type)}</div>
                <p className="text-xs text-center truncate w-full">{file.name}</p>
                {file.size && <p className="text-xs text-gray-500">{file.size}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>{files.length} items</span>
        <span>{selected || 'No selection'}</span>
      </div>
    </div>
  );
}
