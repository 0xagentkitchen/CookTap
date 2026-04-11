type Listener = () => void;

const listeners = new Set<Listener>();

export function onHostReady(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitHostReady(): void {
  for (const fn of listeners) fn();
}
