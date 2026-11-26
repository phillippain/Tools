import { useSyncExternalStore } from 'react';

// Hash routes (#/class/123) work on GitHub Pages without any server setup.
// The preview build runs inside a sandboxed frame where the address can't
// carry paths, so there the route is kept in memory instead.
const MEMORY = __PREVIEW__;
let memPath = '/';
const listeners = new Set<() => void>();

if (MEMORY && typeof window !== 'undefined') {
  try {
    if (window.location.hash.startsWith('#/')) memPath = window.location.hash.slice(1);
  } catch {
    /* ignore */
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(a.getAttribute('href')!);
  });
}

function subscribe(cb: () => void) {
  if (MEMORY) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  }
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

// Only "#/..." is a route. Anything else in the hash (such as the sign-in
// tokens a confirmation email link brings back) is treated as the home page.
const snapshot = () => {
  if (MEMORY) return memPath;
  const h = window.location.hash;
  return h.startsWith('#/') ? h.slice(1) : '/';
};

export function useRoutePath(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '/');
}

export function useRoute(): string[] {
  return useRoutePath().split('?')[0].split('/').filter(Boolean);
}

export function useQuery(): URLSearchParams {
  return new URLSearchParams(useRoutePath().split('?')[1] ?? '');
}

export function go(path: string) {
  const p = path.replace(/^#/, '') || '/';
  if (MEMORY) {
    memPath = p;
    listeners.forEach((f) => f());
  } else {
    window.location.hash = `#${p}`;
  }
}

export const href = (path: string) => `#${path}`;
