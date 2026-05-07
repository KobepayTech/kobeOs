import type { FSNode } from './types';

let fsMap: Map<string, FSNode> = new Map();
let initialized = false;

function generateId(): string {
  return `fs_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function saveFs(): void {
  const obj = Object.fromEntries(fsMap.entries());
  localStorage.setItem('kobe_fs', JSON.stringify(obj));
}

function loadFs(): Map<string, FSNode> {
  const raw = localStorage.getItem('kobe_fs');
  if (!raw) return new Map();
  const parsed = JSON.parse(raw) as Record<string, FSNode>;
  return new Map(Object.entries(parsed));
}

function initFs(): void {
  if (initialized) return;
  const saved = loadFs();
  if (saved.size > 0) {
    fsMap = saved;
    initialized = true;
    return;
  }
  // Create root
  const rootId = generateId();
  fsMap.set(rootId, {
    id: rootId, name: '', type: 'directory', parentId: null,
    size: 0, createdAt: Date.now(), modifiedAt: Date.now(), children: [],
  });
  // Create /home
  const homeId = generateId();
  fsMap.set(homeId, {
    id: homeId, name: 'home', type: 'directory', parentId: rootId,
    size: 0, createdAt: Date.now(), modifiedAt: Date.now(), children: [],
  });
  root().children!.push(homeId);
  // Create /home/user
  const userId = generateId();
  fsMap.set(userId, {
    id: userId, name: 'user', type: 'directory', parentId: homeId,
    size: 0, createdAt: Date.now(), modifiedAt: Date.now(), children: [],
  });
  getNode(homeId)!.children!.push(userId);
  // Create standard dirs under /home/user
  const dirs = ['Documents', 'Pictures', 'Music', 'Downloads', 'Desktop'];
  for (const d of dirs) {
    const id = generateId();
    fsMap.set(id, {
      id, name: d, type: 'directory', parentId: userId,
      size: 0, createdAt: Date.now(), modifiedAt: Date.now(), children: [],
    });
    getNode(userId)!.children!.push(id);
  }
  saveFs();
  initialized = true;
}

function root(): FSNode {
  for (const [, node] of fsMap) {
    if (node.parentId === null) return node;
  }
  throw new Error('FS root not found');
}

function getNode(id: string): FSNode | undefined {
  return fsMap.get(id);
}

function resolvePath(path: string): FSNode | null {
  initFs();
  const parts = path.split('/').filter(Boolean);
  let current = root();
  if (parts.length === 0) return current;
  for (const part of parts) {
    const children = current.children?.map((cid) => getNode(cid)) ?? [];
    const found = children.find((c) => c && c.name === part);
    if (!found) return null;
    current = found;
  }
  return current;
}

function resolveParent(path: string): { parent: FSNode; name: string } | null {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  if (idx === -1) return null;
  const dirPath = trimmed.slice(0, idx) || '/';
  const name = trimmed.slice(idx + 1);
  const parent = resolvePath(dirPath);
  if (!parent || parent.type !== 'directory') return null;
  return { parent, name };
}

export const fs = {
  mkdir(path: string): FSNode | null {
    initFs();
    if (fs.exists(path)) return resolvePath(path);
    const res = resolveParent(path);
    if (!res) return null;
    const { parent, name } = res;
    const id = generateId();
    const node: FSNode = {
      id, name, type: 'directory', parentId: parent.id,
      size: 0, createdAt: Date.now(), modifiedAt: Date.now(), children: [],
    };
    fsMap.set(id, node);
    parent.children = parent.children ?? [];
    parent.children.push(id);
    parent.modifiedAt = Date.now();
    saveFs();
    return node;
  },
  writeFile(path: string, content: string | ArrayBuffer, mimeType?: string): FSNode | null {
    initFs();
    const existing = resolvePath(path);
    let node: FSNode;
    const size = typeof content === 'string' ? content.length : content.byteLength;
    if (existing && existing.type === 'file') {
      node = { ...existing, content, mimeType: mimeType ?? existing.mimeType, size, modifiedAt: Date.now() };
      fsMap.set(existing.id, node);
      saveFs();
      return node;
    }
    const res = resolveParent(path);
    if (!res) return null;
    const { parent, name } = res;
    const id = generateId();
    node = {
      id, name, type: 'file', parentId: parent.id,
      content, mimeType: mimeType ?? 'text/plain', size,
      createdAt: Date.now(), modifiedAt: Date.now(),
    };
    fsMap.set(id, node);
    parent.children = parent.children ?? [];
    parent.children.push(id);
    parent.modifiedAt = Date.now();
    saveFs();
    return node;
  },
  readFile(path: string): string | ArrayBuffer | null {
    initFs();
    const node = resolvePath(path);
    if (!node || node.type !== 'file') return null;
    return node.content ?? null;
  },
  readdir(path: string): FSNode[] {
    initFs();
    const node = resolvePath(path);
    if (!node || node.type !== 'directory') return [];
    return (node.children ?? []).map((cid) => getNode(cid)).filter(Boolean) as FSNode[];
  },
  exists(path: string): boolean {
    initFs();
    return resolvePath(path) !== null;
  },
  delete(path: string): boolean {
    initFs();
    const node = resolvePath(path);
    if (!node) return false;
    if (node.type === 'directory' && (node.children?.length ?? 0) > 0) return false;
    if (node.parentId) {
      const parent = getNode(node.parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter((cid) => cid !== node.id);
        parent.modifiedAt = Date.now();
      }
    }
    fsMap.delete(node.id);
    saveFs();
    return true;
  },
  move(srcPath: string, destPath: string): boolean {
    initFs();
    const node = resolvePath(srcPath);
    if (!node) return false;
    const destExists = resolvePath(destPath);
    if (destExists) return false;
    const res = resolveParent(destPath);
    if (!res) return false;
    const { parent: newParent, name: newName } = res;
    if (node.parentId) {
      const oldParent = getNode(node.parentId);
      if (oldParent && oldParent.children) {
        oldParent.children = oldParent.children.filter((cid) => cid !== node.id);
        oldParent.modifiedAt = Date.now();
      }
    }
    node.parentId = newParent.id;
    node.name = newName;
    node.modifiedAt = Date.now();
    newParent.children = newParent.children ?? [];
    newParent.children.push(node.id);
    newParent.modifiedAt = Date.now();
    saveFs();
    return true;
  },
  stat(path: string): FSNode | null {
    initFs();
    return resolvePath(path);
  },
  getPathById(nodeId: string): string {
    initFs();
    const parts: string[] = [];
    let current = getNode(nodeId);
    while (current && current.parentId !== null) {
      parts.unshift(current.name);
      current = getNode(current.parentId);
    }
    return '/' + parts.join('/');
  },
  getNodeById(id: string): FSNode | undefined {
    initFs();
    return getNode(id);
  },
  _reset(): void {
    fsMap = new Map();
    initialized = false;
    localStorage.removeItem('kobe_fs');
  },
};
