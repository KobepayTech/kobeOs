import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Star, Trash2, Archive, Send, Plus, Search, ChevronLeft,
  Reply, Forward, X, Bold, Italic, List, ListOrdered, Clock,
  AlertCircle, Paperclip
} from 'lucide-react';

interface EmailMessage {
  id: string;
  folder: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: number;
  read: boolean;
  starred: boolean;
  html?: boolean;
}

const STORAGE_KEY = 'kobe_email_messages';

const FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: Mail },
  { id: 'sent', name: 'Sent', icon: Send },
  { id: 'drafts', name: 'Drafts', icon: Clock },
  { id: 'trash', name: 'Trash', icon: Trash2 },
  { id: 'starred', name: 'Starred', icon: Star },
  { id: 'archive', name: 'Archive', icon: Archive },
];

const DEMO_EMAILS: EmailMessage[] = [
  {
    id: 'e1', folder: 'inbox', from: 'hr@company.com', to: 'me@kobe.os',
    subject: 'Welcome to the team!',
    body: 'Hi there,\n\nWelcome aboard! We are thrilled to have you join us. Your onboarding session is scheduled for Monday at 10 AM. Please bring your ID and laptop.\n\nBest regards,\nHR Team',
    date: Date.now() - 3600000 * 2, read: false, starred: true,
  },
  {
    id: 'e2', folder: 'inbox', from: 'dev-team@company.com', to: 'me@kobe.os',
    subject: 'Sprint 14 Retrospective Notes',
    body: 'Team,\n\nHere are the notes from our retrospective:\n\n- Improved CI/CD pipeline speed by 40%\n- Resolved 12 critical bugs\n- Next sprint focus: performance optimization\n\nLet me know if you have any questions.\n\nCheers,\nLead Dev',
    date: Date.now() - 3600000 * 8, read: true, starred: false,
  },
  {
    id: 'e3', folder: 'inbox', from: 'notifications@github.com', to: 'me@kobe.os',
    subject: 'New security alert for your repository',
    body: 'We detected a new security advisory affecting one of your dependencies. Please review the alert on your repository security tab and update to the patched version.\n\nRepository: kobe-os\nPackage: lodash\nSeverity: Moderate',
    date: Date.now() - 3600000 * 24, read: true, starred: false,
  },
  {
    id: 'e4', folder: 'inbox', from: 'alice@partner.io', to: 'me@kobe.os',
    subject: 'Partnership Proposal Q3',
    body: 'Hello,\n\nI hope this email finds you well. I wanted to follow up on our conversation regarding a potential partnership for Q3.\n\nAttached is our preliminary proposal. I would love to schedule a call next week to discuss details.\n\nLooking forward to hearing from you.\n\nAlice Chen\nPartnerships Lead',
    date: Date.now() - 3600000 * 48, read: false, starred: true,
  },
  {
    id: 'e5', folder: 'inbox', from: 'billing@aws.com', to: 'me@kobe.os',
    subject: 'Your monthly invoice is ready',
    body: 'Your AWS bill for May is now available.\n\nTotal: $127.43\n\nServices:\n- EC2: $45.20\n- S3: $12.10\n- RDS: $38.50\n- CloudFront: $31.63\n\nView full invoice: [link]\n\nThank you for using AWS.',
    date: Date.now() - 3600000 * 72, read: true, starred: false,
  },
];

function loadEmails(): EmailMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEMO_EMAILS;
}

function saveEmails(emails: EmailMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
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
  const [emails, setEmails] = useState<EmailMessage[]>(loadEmails);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyMode, setReplyMode] = useState(false);

  useEffect(() => { saveEmails(emails); }, [emails]);

  const folderEmails = emails.filter(e => {
    if (activeFolder === 'starred') return e.starred && e.folder !== 'trash';
    return e.folder === activeFolder;
  }).filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.subject.toLowerCase().includes(q) || e.from.toLowerCase().includes(q) || e.body.toLowerCase().includes(q);
  }).sort((a, b) => b.date - a.date);

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

  const markRead = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  };

  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
  };

  const moveToTrash = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: 'trash' } : e));
    setSelectedEmailId(null);
  };

  const archiveEmail = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: 'archive' } : e));
    setSelectedEmailId(null);
  };

  const markUnread = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: false } : e));
  };

  const sendEmail = useCallback(() => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    const newEmail: EmailMessage = {
      id: `e_${Date.now()}`,
      folder: 'sent',
      from: 'me@kobe.os',
      to: composeTo,
      subject: composeSubject,
      body: composeBody,
      date: Date.now(),
      read: true,
      starred: false,
    };
    setEmails(prev => [...prev, newEmail]);
    setComposeOpen(false);
    setReplyMode(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  }, [composeTo, composeSubject, composeBody]);

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
    setComposeBody(prev => prev + tag);
  };

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Folder Pane */}
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
          {FOLDERS.map(folder => {
            const count = folder.id === 'inbox'
              ? emails.filter(e => e.folder === 'inbox' && !e.read).length
              : folder.id === 'starred'
              ? emails.filter(e => e.starred && e.folder !== 'trash').length
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

      {/* Message List */}
      <div className={`${selectedEmailId ? 'hidden md:flex md:w-80' : 'flex-1 md:w-80'} bg-white border-r border-slate-200 flex flex-col shrink-0`}>
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
          {folderEmails.map(email => (
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
                  onClick={e => toggleStar(email.id, e)}
                  className={`shrink-0 ${email.starred ? 'text-yellow-500' : 'text-slate-300 hover:text-slate-400'}`}
                >
                  <Star className="w-3.5 h-3.5" fill={email.starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reading Pane */}
      {selectedEmail ? (
        <div className="flex-1 flex flex-col bg-white min-w-0">
          <div className="flex items-center gap-1 p-3 border-b border-slate-200">
            <button
              onClick={() => setSelectedEmailId(null)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-700"
            >
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
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {selectedEmail.body}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-slate-50 text-slate-400">
          <Mail className="w-12 h-12 mb-3" />
          <p className="text-sm">Select an email to read</p>
        </div>
      )}

      {/* Compose Modal */}
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
                  onChange={e => setComposeTo(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 w-16 shrink-0">Subject</span>
                <input
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
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
                onChange={e => setComposeBody(e.target.value)}
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
