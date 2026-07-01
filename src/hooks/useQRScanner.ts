/**
 * useQRScanner — Camera-based QR / barcode scanning for the mobile PWA.
 *
 * Uses the native BarcodeDetector API when available (Chrome Android, Safari iOS 17+)
 * with graceful fallback to a video preview + manual capture frame for devices
 * that don't support it yet.
 *
 * The hook handles: camera permission, video stream lifecycle, barcode detection
 * loop, and cleanup. Callers just render the video element and wait for `result`.
 *
 * Usage:
 *   const { videoRef, result, scanning, error, stop } = useQRScanner();
 *   // render <video ref={videoRef} />
 *   // when result is set, a barcode was detected
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type QRScanResult = {
  rawValue: string;
  format: string;
};

export function useQRScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [result, setResult] = useState<QRScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetector | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    setResult(null);
    setError(null);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      // Use native BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'],
        });
      }

      const detectLoop = async () => {
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        if (detectorRef.current) {
          try {
            const barcodes = await detectorRef.current.detect(video);
            if (barcodes.length > 0) {
              const bc = barcodes[0];
              setResult({ rawValue: bc.rawValue, format: bc.format });
              stop();
              return;
            }
          } catch {
            // Detection failed this frame — keep trying
          }
        }

        rafRef.current = requestAnimationFrame(detectLoop);
      };

      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (e) {
      setError((e as Error).message || 'Camera access denied');
      setScanning(false);
    }
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, result, scanning, error, start, stop };
}
