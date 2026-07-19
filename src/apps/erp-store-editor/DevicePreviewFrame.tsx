import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children inside an <iframe> so the preview has its OWN viewport
 * width. This is the piece that makes the "Desktop / Mobile" toggle HONEST:
 * Tailwind's responsive breakpoints (sm/md/lg) respond to the frame's width,
 * not the editor window — so at 390px the storefront collapses to its real
 * mobile layout, exactly like a phone. A plain `width: 390px` wrapper can't
 * do this: the media queries would still see the desktop editor window and
 * keep showing desktop columns.
 *
 * The app's stylesheets (Vite injects <style> in dev, <link> in prod) are
 * cloned into the frame's <head> and re-synced on change, so every utility
 * class and CSS variable works inside the frame.
 */
export function DevicePreviewFrame({
  width,
  children,
}: {
  /** Frame width in px, or '100%' to fill the pane (desktop). */
  width: number | '100%';
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    // Base scaffold so `h-full` / `min-h-screen` inside the preview resolve
    // against the frame, and the frame paints white behind the storefront.
    doc.documentElement.style.height = '100%';
    doc.body.style.margin = '0';
    doc.body.style.height = '100%';
    doc.body.style.background = '#ffffff';

    const syncStyles = () => {
      doc.querySelectorAll('[data-cloned-style]').forEach((n) => n.remove());
      document.head
        .querySelectorAll('style, link[rel="stylesheet"]')
        .forEach((node) => {
          const clone = node.cloneNode(true) as HTMLElement;
          clone.setAttribute('data-cloned-style', '');
          doc.head.appendChild(clone);
        });
    };
    syncStyles();

    // Vite injects/updates <style> tags during HMR — keep the frame in sync.
    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, { childList: true, subtree: true });

    setBody(doc.body);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <iframe
        ref={frameRef}
        title="Storefront preview"
        className="block h-full bg-white shadow-2xl"
        style={{
          width: width === '100%' ? '100%' : `${width}px`,
          border: 'none',
          margin: '0 auto',
        }}
      />
      {body && createPortal(children, body)}
    </>
  );
}
