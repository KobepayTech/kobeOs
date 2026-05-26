import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/global.css';
import { Desktop } from './os/Desktop';

// /sports/overlay is a standalone transparent OBS browser source page.
// All other paths mount the full OS shell.
const isOverlay = window.location.pathname.startsWith('/sports/overlay');

if (isOverlay) {
  // Lazy-load to keep the main bundle lean
  import('./apps/kobe-sports/OverlayPage').then(({ default: OverlayPage }) => {
    createRoot(document.getElementById('root')!).render(<OverlayPage />);
  });
} else {
  createRoot(document.getElementById('root')!).render(<Desktop />);
}
