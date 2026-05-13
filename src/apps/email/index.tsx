import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Star, Trash2, Archive, Send, Plus, Search, ChevronLeft,
  Reply, Forward, X, Bold, Italic, List, ListOrdered, Clock,
  AlertCircle, Paperclip
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession, type AuthUser } from '@/lib/auth';

type Folder = 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam';

interface ApiEmail {
  id: string;
  folder: Folder;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  body: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

interface UIEmail {
  id: string;
  folder: Folder;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: number;
  read: boolean;
  starred: boolean;
}

const FOLDERS: Array<{ id: Folder | 'starred'; name: string; icon: typeof Mail }> = [
  { id: 'inbox', name: 'Inbox', icon: Mail },
  { id: 'sent', name: 'Sent', icon: Send },
  { id: 'drafts', name: 'Drafts', icon: Clock },
  { id: 'trash', name: 'Trash', icon: Trash2 },
  { id: 'starred', name: 'Starred', icon: Star },
  { id: 'archive', name: 'Archive', icon: Archive },
];

function fromApi(e: ApiEmail): UIEmail {
  return {
    id: e.id,
    folder: e.folder,
    from: e.fromAddress,
    to: e.toAddresses?.[0] ?? '',
    subject: e.subject,
    body: e.body,
    date: new Date(e.createdAt).getTime(),
    read: e.read,
    starred: e.starred,
  };
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFullDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EmailApp() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [emails, setEmails] = useState<UIEmail[]>([]);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder | 'starred'>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyMode, setReplyMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureSession();
        if (cancelled) return;
        setMe(user);
        const list = await api<ApiEmail[]>('/email');
        if (cancelled) return;
        setEmails(list.map(fromApi));
        setReady(true);
      } catch (err) {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateEmail = useCallback(async (id: string, patch: Partial<ApiEmail>, local: Partial<UIEmail>) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...local } : e)));
    try {
      await api(`/email/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed');
    }
  }, []);

  const folderEmails = emails
    .filter((e) => {
      if (activeFolder === 'starred') return e.starred && e.folder !== 'trash';
      return e.folder === activeFolder;
    })
    .filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.subject.toLowerCase().includes(q) || e.from.toLowerCase().includes(q) || e.body.toLowerCase().includes(q);
    })
    .sort((a, b) => b.date - a.date);

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || null;

  const markRead = (id: string) => {
    const target = emails.find((e) => e.id === id);
    if (!target || target.read) return;
    void updateEmail(id, { read: true }, { read: true });
  };

  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = emails.find((x) => x.id === id);
    if (!target) return;
    void updateEmail(id, { starred: !target.starred }, { starred: !target.starred });
  };

  const moveToTrash = (id: string) => {
    void updateEmail(id, { folder: 'trash' }, { folder: 'trash' });
    setSelectedEmailId(null);
  };

  const archiveEmail = (id: string) => {
    void updateEmail(id, { folder: 'archive' }, { folder: 'archive' });
    setSelectedEmailId(null);
  };

  const markUnread = (id: string) => {
    void updateEmail(id, { read: false }, { read: false });
  };

  const sendEmail = useCallback(async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    try {
      const payload = {
        folder: 'sent',
        fromAddress: me?.email ?? 'me@kobeos.local',
        fromName: me?.displayName ?? '',
        toAddresses: [composeTo.trim()],
        subject: composeSubject,
        body: composeBody,
        read: true,
      };
      const created = await api<ApiEmail>('/email', { method: 'POST', body: JSON.stringify(payload) });
      setEmails((prev) => [fromApi(created), ...prev]);
      setComposeOpen(false);
      setReplyMode(false);
      setComposeTo(''); setComposeSubject(''); setComposeBody('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Send failed');
    }
  }, [composeTo, composeSubject, composeBody, me]);

  const startReply = () => {
    if (!selectedEmail) return;
    setComposeTo(selectedEmail.from);
    setComposeSubject(`Re: ${selectedEmail.subject}`);
    setComposeBody(`\n\n---\nOn ${formatFullDate(selectedEmail.date)}, ${selectedEmail.from} wrote:\n> ${selectedEmail.body.replace(/\n/g, '\n> ')}`);
    setReplyMode(true);
    setComposeOpen(true);
  };

  const startForward = () => {
    if (!selectedEmail) return;
    setComposeTo('');
    setComposeSubject(`Fwd: ${selectedEmail.subject}`);
    setComposeBody(`\n\n--- Forwarded message ---\nFrom: ${selectedEmail.from}\nSubject: ${selectedEmail.subject}\nDate: ${formatFullDate(selectedEmail.date)}\n\n${selectedEmail.body}`);
    setReplyMode(true);
    setComposeOpen(true);
  };

  const insertTag = (tag: string) => {
    setComposeBody((prev) => prev + tag);
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
        {bootError ?? 'Connecting…'}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <div className="w-48 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3">
          <button
            onClick={() => { setComposeOpen(true); setReplyMode(false); setComposeTo(''); setComposeSubject(''); setComposeBody(''); }}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {FOLDERS.map((folder) => {
            const count =
              folder.id === 'inbox'
                ? emails.filter((e) => e.folder === 'inbox' && !e.read).length
                : folder.id === 'starred'
                ? emails.filter((e) => e.starred && e.folder !== 'trash').length
                : 0;
            const isActive = activeFolder === folder.id;
            const Icon = folder.icon;
            return (
              <button
                key={folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedEmailId(null); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{folder.name}</span>
                {count > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${selectedEmailId ? 'hidden md:flex md:w-80' : 'flex-1 md:w-80'} bg-white border-r border-slate-200 flex flex-col shrink-0`}>
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              className="w-full bg-slate-100 border border-transparent rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {folderEmails.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Mail className="w-8 h-8 mb-2" />
              <p className="text-xs">No emails</p>
            </div>
          )}
          {folderEmails.map((email) => (
            <button
              key={email.id}
              onClick={() => { setSelectedEmailId(email.id); markRead(email.id); }}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                selectedEmailId === email.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
              } ${!email.read ? 'bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm truncate ${!email.read ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{email.from}</span>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatDate(email.date)}</span>
              </div>
              <div className={`text-xs truncate mb-0.5 ${!email.read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{email.subject}</div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400 truncate pr-4">{email.body.slice(0, 60).replace(/\n/g, ' ')}</p>
                <button
                  onClick={(e) => toggleStar(email.id, e)}
                  className={`shrink-0 ${email.starred ? 'text-yellow-500' : 'text-slate-300 hover:text-slate-400'}`}
                >
                  <Star className="w-3.5 h-3.5" fill={email.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            </button>
          ))}
        </div>
        {errorMsg && <div className="text-[10px] text-red-500 px-3 py-1 border-t border-slate-200">{errorMsg}</div>}
      </div>

      {selectedEmail ? (
        <div className="flex-1 flex flex-col bg-white min-w-0">
          <div className="flex items-center gap-1 p-3 border-b border-slate-200">
            <button onClick={() => setSelectedEmailId(null)} className="md:hidden p-1.5 text-slate-500 hover:text-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1" />
            <button onClick={startReply} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Reply">
              <Reply className="w-4 h-4" />
            </button>
            <button onClick={startForward} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Forward">
              <Forward className="w-4 h-4" />
            </button>
            <button onClick={() => toggleStar(selectedEmail.id)} className={`p-1.5 rounded transition-colors ${selectedEmail.starred ? 'text-yellow-500 bg-yellow-50' : 'text-slate-500 hover:text-yellow-500 hover:bg-yellow-50'}`} title="Star">
              <Star className="w-4 h-4" fill={selectedEmail.starred ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => archiveEmail(selectedEmail.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Archive">
              <Archive className="w-4 h-4" />
            </button>
            <button onClick={() => markUnread(selectedEmail.id)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Mark unread">
              <AlertCircle className="w-4 h-4" />
            </button>
            <button onClick={() => moveToTrash(selectedEmail.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">{selectedEmail.subject}</h2>
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                {selectedEmail.from.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-sm text-slate-900">{selectedEmail.from}</span>
                  <span className="text-xs text-slate-400">{formatFullDate(selectedEmail.date)}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">To: {selectedEmail.to}</div>
              </div>
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedEmail.body}</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <Mail className="w-12 h-12 mb-3" />
          <p className="text-sm">Select an email to read</p>
        </div>
      )}

      {composeOpen && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">{replyMode ? 'Reply' : 'New Message'}</h3>
              <button onClick={() => { setComposeOpen(false); setReplyMode(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-16 shrink-0">To</span>
                <input
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-16 shrink-0">Subject</span>
                <input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
                <button onClick={() => insertTag('**bold**')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Bold">
                  <Bold className="w-4 h-4" />
                </button>
                <button onClick={() => insertTag('*italic*')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Italic">
                  <Italic className="w-4 h-4" />
                </button>
                <button onClick={() => insertTag('\n- ')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Bullet list">
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => insertTag('\n1. ')} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Numbered list">
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded" title="Attach">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200">
              <button
                onClick={() => { setComposeOpen(false); setReplyMode(false); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={!composeTo.trim() || !composeSubject.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
