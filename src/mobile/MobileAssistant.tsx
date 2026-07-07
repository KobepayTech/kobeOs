import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import KobeAssistant from '@/apps/kobe-assistant';

/**
 * Ask Kobe on the mobile staff PWA. A floating button opens the assistant as a
 * bottom-sheet over the current module. Same offline agent as the desktop
 * co-pilot (answers business questions + confirm-gated actions), just phone-
 * shaped. Only rendered inside the signed-in MobileShell, so it's owner/staff
 * scoped — never on customer storefronts.
 */
export function MobileAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          {/* Bottom sheet: ~85% of the viewport height */}
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white/80"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
            <KobeAssistant />
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-[9997] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl grid place-items-center active:scale-95 transition-transform"
          aria-label="Ask Kobe AI"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </>
  );
}
