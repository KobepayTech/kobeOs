import EodApp from '@/apps/erp-eod';

/** Thin mobile wrapper around the existing EOD app — that component is
 *  already PWA-friendly (mobile-first layout) so we just embed it. */
export default function MobileEod() {
  return (
    <div className="-mx-px">
      <EodApp />
    </div>
  );
}
