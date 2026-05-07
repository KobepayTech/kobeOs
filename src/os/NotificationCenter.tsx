import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useOSStore } from './store';

const typeColors: Record<string, string> = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

/**
 * Toast notifications stacked at the top-right.
 */
export function NotificationCenter() {
  const { notifications, removeNotification } = useOSStore();

  // Only show the most recent 5 non-read as toasts; keep all in a panel (not built here)
  const toasts = notifications.slice(0, 5);

  return (
    <div className="fixed top-3 right-3 z-[500] flex flex-col gap-2 w-[360px] max-w-[90vw]">
      <AnimatePresence>
        {toasts.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-white/10 overflow-hidden shadow-xl"
            style={{
              background: 'rgba(30,41,59,0.98)',
              borderLeft: `4px solid ${typeColors[n.type] ?? '#3b82f6'}`,
            }}
          >
            <div className="flex items-start gap-2 p-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-os-text-primary">{n.title}</div>
                <div className="text-xs text-os-text-secondary mt-0.5">{n.message}</div>
              </div>
              <button
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors shrink-0"
                onClick={() => removeNotification(n.id)}
              >
                <X className="w-3.5 h-3.5 text-os-text-muted" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-white/5">
              <motion.div
                className="h-full"
                style={{ background: typeColors[n.type] ?? '#3b82f6' }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
