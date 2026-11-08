import { useEffect, useRef, useState, useCallback } from 'react';

export type QRScanResult = {
  rawValue: string;
  format: string;
};

export function useQRScanner({ qrFallback = false }: { qrFallback?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [result, setResult] = useState<QRScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const scanId = useRef(0);

  const stop = useCallback(() => {
    scanId.current++;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    const id = scanId.current;
    const current = () => scanId.current === id;
    setResult(null);
    setError(null);
    setScanning(true);

    try {
      const target = videoRef.current;
      if (!target) { stop(); return; }
      const video: HTMLVideoElement = target;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!current()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (!current()) return;

      let native: BarcodeDetector | undefined;
      if (window.BarcodeDetector) {
        try {
          const formats = qrFallback ? ['qr_code'] : ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'];
          native = new window.BarcodeDetector({ formats });
        } catch { /* Use the QR decoder when the native implementation rejects the formats. */ }
      }
      const canvas = qrFallback ? document.createElement('canvas') : undefined;
      const context = canvas?.getContext('2d', { willReadFrequently: true });
      let decoder: typeof import('jsqr').default | undefined;
      let lastDecode = 0;

      async function detect(now: number) {
        if (!current()) return;
        let match: QRScanResult | undefined;
        if (video.readyState >= video.HAVE_CURRENT_DATA && now - lastDecode >= 120) {
          lastDecode = now;
          if (native) {
            try { [match] = await native.detect(video); }
            catch { native = undefined; }
          }
          if (!native && !match && canvas && context && video.videoWidth && current()) {
            try {
              decoder ??= (await import('jsqr')).default;
              if (!current()) return;
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
              const qr = decoder(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' });
              if (qr) match = { rawValue: qr.data, format: 'qr_code' };
            } catch {
              if (!current()) return;
              setError('QR scanning is unavailable');
              stop();
              return;
            }
          }
        }
        if (!current()) return;
        if (match) { setResult(match); stop(); return; }
        rafRef.current = requestAnimationFrame(detect);
      }

      rafRef.current = requestAnimationFrame(detect);
    } catch (cause) {
      if (!current()) return;
      setError((cause as Error).message || 'Camera access denied');
      stop();
    }
  }, [qrFallback, stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, result, scanning, error, start, stop };
}
