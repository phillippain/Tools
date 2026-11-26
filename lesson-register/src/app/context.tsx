import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList } from 'react';
import type { Store, Session } from '../lib/store';
import type { Faculty, Member } from '../lib/types';

export interface AppState {
  store: Store;
  session: Session | null;
  member: Member | null;
  faculty: Faculty | null;
  reload: () => void;
}

export const AppCtx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppCtx);
  if (!v) throw new Error('App context missing');
  return v;
}

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fnRef
      .current()
      .then((data) => live && setState({ data, loading: false }))
      .catch((e: unknown) => live && setState({ error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function canLead(member: Member | null): boolean {
  return member?.role === 'head_teacher' || member?.role === 'admin';
}
