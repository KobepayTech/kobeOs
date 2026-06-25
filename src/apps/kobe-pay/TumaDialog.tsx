import { useEffect } from 'react';
import { X } from 'lucide-react';
import Tuma from '@/public/Tuma';

/**
 * Fullscreen dialog wrapper that mounts the existing /tuma page
 * inside KobePay so the operator can create + redeem vouchers
 * without navigating away. Re-uses everything from src/public/Tuma
 * (QR encoder, scanner, localStorage adapter, bilingual strings).
 */
export function TumaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    // Lock the page scroll behind the dialog so phone users don't
    // double-scroll the OS shell while inside Tuma.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex">
      <div className="relative w-full h-full overflow-auto bg-[#F1EDE4]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white grid place-items-center backdrop-blur"
          aria-label="Close Tuma"
        >
          <X className="w-5 h-5" />
        </button>
        <Tuma />
      </div>
    </div>
  );
}
