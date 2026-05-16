import { createRoot } from 'react-dom/client';
import './index.css';
import { Desktop } from './os/Desktop';

// Mount the real OS shell directly. App.tsx is the legacy simplified shell
// kept for reference but is no longer the entry point.
createRoot(document.getElementById('root')!).render(<Desktop />);
