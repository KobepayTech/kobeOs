// Ambient types for the browser Barcode Detection API (BarcodeDetector),
// which TypeScript's DOM lib does not yet ship. Used by
// src/hooks/useQRScanner.ts. Only the members we actually touch are typed.
//
// Spec: https://wicg.github.io/shape-detection-api/#barcode-detection-api

interface DetectedBarcode {
  rawValue: string;
  format: string;
  boundingBox?: DOMRectReadOnly;
  cornerPoints?: ReadonlyArray<{ x: number; y: number }>;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
