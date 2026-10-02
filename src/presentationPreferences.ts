const MOTION_KEY = 'fleetio.reduce-motion';

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function savedReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(MOTION_KEY) === 'true'; }
  catch { return false; }
}

export function saveReducedMotion(value: boolean): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(MOTION_KEY, String(value)); }
  catch { /* Restricted storage must not prevent presentation changes. */ }
}

export function observeSystemMotion(update: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = () => update(query.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
