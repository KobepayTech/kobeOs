import type { OfflineHotelMutation } from './byte-types';

const STORAGE_KEY = 'kobe.hotel.offline-mutations.v1';

function read(): OfflineHotelMutation[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as OfflineHotelMutation[]; }
  catch { return []; }
}
function write(queue: OfflineHotelMutation[]) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueHotelMutation(input: Omit<OfflineHotelMutation, 'id' | 'createdAt' | 'attempts' | 'idempotencyKey'> & { idempotencyKey?: string }) {
  const id = crypto.randomUUID();
  const mutation: OfflineHotelMutation = {
    ...input,
    id,
    idempotencyKey: input.idempotencyKey || id,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  write([...read(), mutation]);
  return mutation;
}

export function pendingHotelMutations() { return read(); }

export async function flushHotelMutations(
  send: (mutation: OfflineHotelMutation) => Promise<void>,
): Promise<{ sent: number; remaining: number }> {
  const queue = read();
  const remaining: OfflineHotelMutation[] = [];
  let sent = 0;
  for (const mutation of queue) {
    try { await send(mutation); sent += 1; }
    catch { remaining.push({ ...mutation, attempts: mutation.attempts + 1 }); }
  }
  write(remaining);
  return { sent, remaining: remaining.length };
}
