import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileShell, { MobileHome } from './MobileShell';
import MobilePOS from './MobilePOS';
import MobilePO from './MobilePO';
import MobileImageOrder from './MobileImageOrder';
import MobileEod from './MobileEod';
import MobileSummary from './MobileSummary';
import MobileInventory from './MobileInventory';
import MobileOrders from './MobileOrders';
import MobilePrepare from './MobilePrepare';

/**
 * Self-contained router for the /m/:slug mobile webapp. main.tsx dispatches
 * by path prefix and loads this bundle when the URL starts with /m/ — we
 * don't go through App.tsx because the desktop OS branch there would
 * pre-empt the route.
 */
export default function MobileRoot() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/m/:slug" element={<MobileShell />}>
          <Route index element={<MobileHome />} />
          <Route path="pos" element={<MobilePOS />} />
          <Route path="po" element={<MobilePO />} />
          <Route path="image-order" element={<MobileImageOrder />} />
          <Route path="eod" element={<MobileEod />} />
          <Route path="summary" element={<MobileSummary />} />
          <Route path="inventory" element={<MobileInventory />} />
          <Route path="orders" element={<MobileOrders />} />
          <Route path="prepare" element={<MobilePrepare />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
