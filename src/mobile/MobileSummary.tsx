import ErpSummary from '@/apps/erp-summary';

/** Thin mobile wrapper around the existing Sales & Expenses module —
 *  the underlying component is single-column / mobile-friendly so we
 *  just embed it. */
export default function MobileSummary() {
  return <ErpSummary />;
}
