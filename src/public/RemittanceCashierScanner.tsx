import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, RefreshCw, ScanLine } from 'lucide-react';
import { useQRScanner } from '@/hooks/useQRScanner';
import { extractRemittanceCashierCode } from './remittanceCashierQr';

/**
 * KobePay cashier scan landing.
 *
 * Camera QR scans and USB/Bluetooth keyboard-wedge scanners both resolve to the
 * existing /rc/{CODE} payout screen. The cashier never has to search or type a
 * customer/payment reference.
 */
export default function RemittanceCashierScanner() {
  const { videoRef, result, scanning, error: cameraError, start, stop } = useQRScanner();
  const [scanError, setScanError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const keyboardBuffer = useRef('');
  const keyboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canUseCamera =
    typeof window !== 'undefined' &&
    'BarcodeDetector' in window &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const openPayment = useCallback((raw: string) => {
    const code = extractRemittanceCashierCode(raw);
    if (!code) {
      setScanError('This is not a valid KobePay cash-out QR.');
      return false;
    }

    setScanError(null);
    setOpening(true);
    stop();
    window.location.assign(`/rc/${code}`);
    return true;
  }, [stop]);

  useEffect(() => {
    if (!canUseCamera) return;
    void start();
  }, [canUseCamera, start]);

  useEffect(() => {
    if (!result || opening) return;
    if (!openPayment(result.rawValue) && canUseCamera) {
      void start();
    }
  }, [canUseCamera, openPayment, opening, result, start]);

  useEffect(() => {
    const clearBufferLater = () => {
      if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
      keyboardTimer.current = setTimeout(() => {
        keyboardBuffer.current = '';
        keyboardTimer.current = null;
      }, 600);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (opening || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter') {
        const raw = keyboardBuffer.current;
        keyboardBuffer.current = '';
        if (keyboardTimer.current) {
          clearTimeout(keyboardTimer.current);
          keyboardTimer.current = null;
        }
        if (raw) {
          event.preventDefault();
          openPayment(raw);
        }
        return;
      }

      if (event.key.length !== 1) return;

      keyboardBuffer.current += event.key;
      clearBufferLater();

      // Hardware scanners configured to emit only the 8-character claim code
      // work even when they do not append an Enter key.
      if (/^[A-Za-z0-9]{8}$/.test(keyboardBuffer.current)) {
        const raw = keyboardBuffer.current;
        const code = extractRemittanceCashierCode(raw);
        if (code) {
          keyboardBuffer.current = '';
          if (keyboardTimer.current) {
            clearTimeout(keyboardTimer.current);
            keyboardTimer.current = null;
          }
          event.preventDefault();
          openPayment(code);
        }
      }

      if (keyboardBuffer.current.length > 512) {
        keyboardBuffer.current = keyboardBuffer.current.slice(-512);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (keyboardTimer.current) clearTimeout(keyboardTimer.current);
    };
  }, [openPayment, opening]);

  return (
    <div className="min-h-screen bg-[#090b10] text-white grid place-items-center px-4 py-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/15 text-emerald-300 grid place-items-center">
            <ScanLine className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-2xl font-black">KobePay Cashier</h1>
          <p className="mt-1 text-sm text-white/50">Scan the customer QR and continue.</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] overflow-hidden">
          {canUseCamera ? (
            <div className="relative aspect-square bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-2 border-emerald-400/80 shadow-[0_0_0_999px_rgba(0,0,0,0.34)]" />
              <div className="absolute bottom-4 left-0 right-0 text-center text-xs font-semibold text-white/80">
                {opening ? 'Opening payment…' : scanning ? 'Scanner ready' : 'Camera stopped'}
              </div>
            </div>
          ) : (
            <div className="aspect-[4/3] grid place-items-center p-8 text-center">
              <div>
                <Keyboard className="h-10 w-10 mx-auto text-emerald-300" />
                <div className="mt-3 font-bold">QR scanner ready</div>
                <p className="mt-1 text-xs text-white/45">Use the connected USB or Bluetooth QR scanner.</p>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            {scanError && <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-200">{scanError}</div>}
            {cameraError && <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm text-amber-200">{cameraError}</div>}

            {canUseCamera && !scanning && !opening && (
              <button
                type="button"
                onClick={() => void start()}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold inline-flex items-center justify-center gap-2"
              >
                {cameraError ? <Camera className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                Start scanner
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-white/35">
              <Keyboard className="h-3.5 w-3.5" />
              USB/Bluetooth scanners work automatically
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
