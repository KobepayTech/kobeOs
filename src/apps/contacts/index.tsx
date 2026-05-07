import { useState, useEffect } from 'react';
import {
  Users, Search, Plus, Trash2, Edit2, Check, X, Download, Upload,
  Mail, Phone, Building2, Briefcase, MapPin, StickyNote, Tag, ChevronRight
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  address: string;
  notes: string;
  groups: string[];
  color: string;
}

const STORAGE_KEY = 'kobe_contacts';
const GROUPS_KEY = 'kobe_contact_groups';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const DEMO_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Alex Chen', email: 'alex@company.com', phone: '+1 (555) 123-4567', company: 'TechCorp', jobTitle: 'Product Manager', address: '123 Innovation Dr, San Francisco, CA', notes: 'Met at DevCon 2024. Interested in partnership.', groups: ['Work'], color: '#ef4444' },
  { id: 'c2', name: 'Jordan Lee', email: 'jordan@design.io', phone: '+1 (555) 234-5678', company: 'Design Studio', jobTitle: 'Lead Designer', address: '456 Creative Ave, New York, NY', notes: 'Great UI/UX insights. Follow up on Q3 project.', groups: ['Work', 'Design'], color: '#f59e0b' },
  { id: 'c3', name: 'Taylor Kim', email: 'taylor@startup.co', phone: '+1 (555) 345-6789', company: 'StartupCo', jobTitle: 'CTO', address: '789 Startup Way, Austin, TX', notes: 'Looking for engineering talent. Referral possible.', groups: ['Work'], color: '#10b981' },
  { id: 'c4', name: 'Morgan Wu', email: 'morgan@freelance.dev', phone: '+1 (555) 456-7890', company: 'Freelance', jobTitle: 'Full Stack Developer', address: '321 Code St, Seattle, WA', notes: 'Available for contract work. Rate: $120/hr.', groups: ['Freelancers'], color: '#8b5cf6' },
  { id: 'c5', name: 'Riley Park', email: 'riley@marketing.pro', phone: '+1 (555) 567-8901', company: 'Marketing Pro', jobTitle: 'Marketing Director', address: '654 Brand Blvd, Los Angeles, CA', notes: 'Campaign launch next month. Budget $50K.', groups: ['Work', 'Marketing'], color: '#ec4899' },
  { id: 'c6', name: 'Casey Brown', email: 'casey@finance.io', phone: '+1 (555) 678-9012', company: 'Finance IO', jobTitle: 'CFO', address: '987 Wall St, New York, NY', notes: 'Reviewing our Q2 financials. Meeting scheduled.', groups: ['Work', 'Finance'], color: '#06b6d4' },
  { id: 'c7', name: 'Jamie Smith', email: 'jamie@family.net', phone: '+1 (555) 789-0123', company: '', jobTitle: '', address: '111 Home Lane, Portland, OR', notes: 'Family friend. Birthday in November.', groups: ['Personal'], color: '#f97316' },
  { id: 'c8', name: 'Drew Johnson', email: 'drew@gym.fit', phone: '+1 (555) 890-1234', company: 'FitLife Gym', jobTitle: 'Personal Trainer', address: '222 Health Ave, Denver, CO', notes: 'Personal trainer. Sessions on Tue/Thu.', groups: ['Personal'], color: '#3b82f6' },
];

const DEMO_GROUPS = ['Work', 'Personal', 'Design', 'Marketing', 'Finance', 'Freelancers'];

function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEMO_CONTACTS;
}

function loadGroups(): string[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEMO_GROUPS;
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

function saveGroups(groups: string[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
}

export default function ContactsApp({ windowId }: { windowId: string; data?: any }) {
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [groups, setGroups] = useState<string[]>(loadGroups);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const [form, setForm] = useState<Partial<Contact>>({});

  useEffect(() => { saveContacts(contacts); }, [contacts]);
  useEffect(() => { saveGroups(groups); }, [groups]);

  const selected = contacts.find(c => c.id === selectedId) || null;

  const filtered = contacts.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = filterGroup === 'All' || c.groups.includes(filterGroup);
    return matchesSearch && matchesGroup;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const startAdd = () => {
    setAdding(true);
    setEditing(false);
    setSelectedId(null);
    setForm({ name: '', email: '', phone: '', company: '', jobTitle: '', address: '', notes: '', groups: [], color: COLORS[Math.floor(Math.random() * COLORS.length)] });
  };

  const startEdit = () => {
    if (!selected) return;
    setEditing(true);
    setAdding(false);
    setForm({ ...selected });
  };

  const saveForm = () => {
    if (!form.name?.trim()) return;
    if (adding) {
      const newContact: Contact = {
        id: `c_${Date.now()}`,
        name: form.name || '',
        email: form.email || '',
        phone: form.phone || '',
        company: form.company || '',
        jobTitle: form.jobTitle || '',
        address: form.address || '',
        notes: form.notes || '',
        groups: form.groups || [],
        color: form.color || COLORS[0],
      };
      setContacts(prev => [...prev, newContact]);
      setSelectedId(newContact.id);
    } else if (editing && selected) {
      setContacts(prev => prev.map(c => c.id === selected.id ? { ...c, ...form } as Contact : c));
    }
    setAdding(false);
    setEditing(false);
  };

  const deleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const exportJSON = () => {
    const data = JSON.stringify({ contacts, groups }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.contacts) setContacts(data.contacts);
          if (data.groups) setGroups(data.groups);
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const addGroup = () => {
    if (newGroup.trim() && !groups.includes(newGroup.trim())) {
      setGroups(prev => [...prev, newGroup.trim()]);
      setNewGroup('');
      setShowNewGroup(false);
    }
  };

  const toggleGroup = (group: string) => {
    const current = form.groups || [];
    if (current.includes(group)) {
      setForm({ ...form, groups: current.filter(g => g !== group) });
    } else {
      setForm({ ...form, groups: [...current, group] });
    }
  };

  const isFormMode = adding || editing;

  return (
    <div className="flex h-full bg-white text-slate-900 overflow-hidden">
      {/* Left: Contact List */}
      <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-sm">Contacts</span>
            </div>
            <button onClick={startAdd} className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterGroup('All')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filterGroup === 'All' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            >
              All
            </button>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => setFilterGroup(g)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filterGroup === g ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Users className="w-8 h-8 mb-2" />
              <p className="text-xs">No contacts found</p>
            </div>
          )}
          {filtered.map(contact => (
            <button
              key={contact.id}
              onClick={() => { setSelectedId(contact.id); setAdding(false); setEditing(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                selectedId === contact.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-slate-100 border-l-4 border-l-transparent'
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: contact.color }}
              >
                {getInitials(contact.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{contact.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{contact.email || contact.phone || contact.company}</div>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-slate-200 flex gap-1">
          <button onClick={exportJSON} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors">
            <Download className="w-3 h-3" />
            Export
          </button>
          <button onClick={importJSON} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors">
            <Upload className="w-3 h-3" />
            Import
          </button>
        </div>
      </div>

      {/* Right: Detail / Form */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {!selected && !isFormMode && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 mb-3" />
            <p className="text-sm">Select a contact to view details</p>
          </div>
        )}

        {isFormMode && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">{adding ? 'New Contact' : 'Edit Contact'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                <input
                  value={form.name || ''}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.email || ''}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.phone || ''}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Company</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.company || ''}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Job Title</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.jobTitle || ''}
                    onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.address || ''}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                <div className="relative">
                  <StickyNote className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <textarea
                    value={form.notes || ''}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Groups</label>
                <div className="flex flex-wrap gap-1.5">
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGroup(g)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        (form.groups || []).includes(g) ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                  {!showNewGroup && (
                    <button onClick={() => setShowNewGroup(true)} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 border border-dashed border-slate-300 transition-colors">
                      + New Group
                    </button>
                  )}
                  {showNewGroup && (
                    <div className="flex items-center gap-1">
                      <input
                        value={newGroup}
                        onChange={e => setNewGroup(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addGroup(); }}
                        placeholder="Group name"
                        className="w-28 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={addGroup} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => { setShowNewGroup(false); setNewGroup(''); }} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={saveForm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                Save
              </button>
              <button onClick={() => { setAdding(false); setEditing(false); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {selected && !isFormMode && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white"
                  style={{ backgroundColor: selected.color }}
                >
                  {getInitials(selected.name)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                  {selected.jobTitle && selected.company && (
                    <p className="text-sm text-slate-500">{selected.jobTitle} at {selected.company}</p>
                  )}
                  {selected.jobTitle && !selected.company && (
                    <p className="text-sm text-slate-500">{selected.jobTitle}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={startEdit} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => deleteContact(selected.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-w-lg">
              {selected.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="text-sm text-slate-900">{selected.email}</div>
                  </div>
                </div>
              )}
              {selected.phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Phone</div>
                    <div className="text-sm text-slate-900">{selected.phone}</div>
                  </div>
                </div>
              )}
              {selected.company && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Company</div>
                    <div className="text-sm text-slate-900">{selected.company}</div>
                  </div>
                </div>
              )}
              {selected.address && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Address</div>
                    <div className="text-sm text-slate-900">{selected.address}</div>
                  </div>
                </div>
              )}
              {selected.notes && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
                    <StickyNote className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Notes</div>
                    <div className="text-sm text-slate-900 whitespace-pre-wrap">{selected.notes}</div>
                  </div>
                </div>
              )}
              {selected.groups.length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Groups</div>
                    <div className="flex flex-wrap gap-1">
                      {selected.groups.map(g => (
                        <span key={g} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">{g}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
