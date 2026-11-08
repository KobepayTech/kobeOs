export function newIncomingOrderNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `PO-${suffix.toUpperCase()}`;
}
