import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as icons from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  description: string;
  color: string;
}

function loadEvents(): CalendarEvent[] {
  const raw = localStorage.getItem('kobe_calendar');
  return raw ? JSON.parse(raw) : [];
}

function saveEvents(events: CalendarEvent[]) {
  localStorage.setItem('kobe_calendar', JSON.stringify(events));
}

export default function Calendar() {
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [form, setForm] = useState({ title: '', time: '09:00', description: '', color: '#3b82f6' });

  useEffect(() => {
    saveEvents(events);
  }, [events]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const getEventsForDate = (d: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return events.filter((e) => e.date === ds);
  };

  const openModal = (dateStr: string) => {
    setModalDate(dateStr);
    setForm({ title: '', time: '09:00', description: '', color: '#3b82f6' });
    setModalOpen(true);
  };

  const addEvent = () => {
    if (!form.title) return;
    const ev: CalendarEvent = {
      id: `ev_${Date.now()}`,
      ...form,
      date: modalDate,
    };
    setEvents((prev) => [...prev, ev]);
    setModalOpen(false);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-sm text-os-text-primary">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <button className="w-7 h-7 rounded-md hover:bg-white/10" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
            <icons.ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold">{monthNames[month]} {year}</span>
          <button className="w-7 h-7 rounded-md hover:bg-white/10" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
            <icons.ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              className={`px-2 py-1 text-xs capitalize ${view === v ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-muted'}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month View */}
      {view === 'month' && (
        <div className="flex-1 p-3">
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
              <div key={d} className="text-xs font-semibold text-os-text-muted py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(d);
              return (
                <button
                  key={d}
                  className={`min-h-[72px] rounded-lg border p-1 text-left transition-colors ${
                    isToday ? 'border-os-accent bg-os-accent/5' : 'border-white/5 hover:bg-white/5'
                  }`}
                  onClick={() => openModal(ds)}
                >
                  <div className={`text-xs font-medium mb-0.5 ${isToday ? 'text-os-accent' : 'text-os-text-secondary'}`}>{d}</div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <div key={e.id} className="text-[10px] px-1 py-0.5 rounded truncate" style={{ background: e.color + '30', color: e.color }}>
                        {e.title}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="flex-1 p-3">
          <div className="text-center text-os-text-muted py-10">Week view — select a day in Month view to add events</div>
        </div>
      )}

      {view === 'day' && (
        <div className="flex-1 p-3">
          <div className="text-center text-os-text-muted py-10">Day view — select a day in Month view to add events</div>
        </div>
      )}

      {/* Event list */}
      <div className="h-40 border-t border-white/[0.08] overflow-auto">
        <div className="px-3 py-2 text-xs font-semibold text-os-text-muted uppercase">Events</div>
        <div className="px-3 space-y-1">
          {events.length === 0 && <div className="text-xs text-os-text-muted">No events</div>}
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border border-white/5 hover:bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                <div>
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-os-text-muted">{e.date} at {e.time}</div>
                </div>
              </div>
              <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20" onClick={() => deleteEvent(e.id)}>
                <icons.X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalOpen(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-80 bg-[#1e293b] border border-white/10 rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-3">Add Event — {modalDate}</h3>
            <input className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <textarea className="w-full mb-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none resize-none h-16" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex gap-2 mb-3">
              {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((c) => (
                <button key={c} className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg bg-os-accent text-white text-sm font-medium" onClick={addEvent}>Add</button>
              <button className="flex-1 py-2 rounded-lg bg-white/5 text-os-text-secondary text-sm" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
