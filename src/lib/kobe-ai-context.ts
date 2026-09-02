export interface KobeScreenContext {
  appId?: string;
  module?: string;
  screenLabel?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  fields?: Record<string, unknown>;
}

/**
 * Publish the record currently selected in a KobeOS module so Ask Kobe can
 * understand "this tenant", "this booking", "this shipment", etc. without
 * coupling the assistant to every module implementation.
 */
export function setKobeScreenContext(context: KobeScreenContext): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<KobeScreenContext>('kobe:screen-context', { detail: context }));
}

export function clearKobeScreenEntity(): void {
  setKobeScreenContext({
    entityType: undefined,
    entityId: undefined,
    entityLabel: undefined,
    fields: undefined,
  });
}
