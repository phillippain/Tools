export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Today's date in the user's own time zone, as YYYY-MM-DD. */
export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue 3 Feb" */
export function shortDate(iso: string): string {
  const d = fromISO(iso);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

/** "3 Feb 2027" */
export function longDate(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

/** "3 Feb" or "3 Feb – 21 Mar" */
export function dateSpan(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const a = fromISO(sorted[0]);
  const b = fromISO(sorted[sorted.length - 1]);
  const fa = `${a.getDate()} ${MON[a.getMonth()]}`;
  const fb = `${b.getDate()} ${MON[b.getMonth()]}`;
  return sorted[0] === sorted[sorted.length - 1] ? fa : `${fa} – ${fb}`;
}

/** Move back n school days (Mon–Fri) from a date. */
export function schoolDaysBefore(from: Date, n: number): string {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() - 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return toISO(d);
}

export function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? one + 's')}`;
}

/** Safe wrapper for localStorage: some embedded views throw on access. */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};
const memory = new Map<string, string>();

/** A stored web address, only if it is a plain http(s) link that is safe to open. */
export function safeHref(u?: string): string | undefined {
  return u && /^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : undefined;
}
