// Worksheets saved to Google Drive from the HSC Economics Worksheet Maker, offered as lesson resources.
//
// The Worksheet Maker runs on the same site (phillippain.github.io), so it shares this browser's storage:
//   worksheet-maker:drive        its "Worksheet saver" connection: the web app address and private key
//   worksheet-maker:drive-saved  a note of each worksheet saved from this computer
// The saver is the teacher's own Google Apps Script web app (HSC-Economics/worksheet-maker/drive-saver/Code.gs).
// Its `list` action returns the worksheets in the Worksheets folders on the shared drives. Nothing here goes into the
// database except the resources a teacher adds to a lesson record.
import type { AddedResource, Program } from './types';
import { safeHref, safeStorage } from './util';

export const CONN_KEY = 'worksheet-maker:drive';
export const SAVED_KEY = 'worksheet-maker:drive-saved';

export interface SaverConnection {
  url: string;
  key: string;
  via?: '' | 'fetch' | 'frame';
}

export interface DriveWorksheet {
  id: string; // the student copy's Drive file id
  url: string;
  title: string;
  place: string; // "hsc-t3", "y11-p2"
  label: string; // "Topic 3 Economic Issues", "02 Markets"
  course?: string; // "hsc" | "y11"
  topic?: number | null;
  area?: string | null; // Year 11 focus area, "P2"
  at: string; // ISO date and time saved
  answers?: string | null;
  codes?: string[];
  count?: number | null;
  marks?: number | null;
}

export interface LessonFocus {
  course?: string;
  topics: number[];
  areas: string[];
}

export class SaverError extends Error {
  constructor(public code: string, detail?: string) {
    super(detail || code);
  }
}

const SAVER_URL = /^https:\/\/script\.google\.com\/(a\/macros\/[^/?#]+|macros)\/s\/[\w-]{20,}\/exec$/;
const TEST_URL = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/.*\/exec$/;

/** A Google Apps Script web app address (or a local test address). */
export function isSaverUrl(u: string): boolean {
  return SAVER_URL.test(u) || TEST_URL.test(u);
}

export function readConnection(): SaverConnection | null {
  try {
    const v = JSON.parse(safeStorage.get(CONN_KEY) || 'null');
    if (v && typeof v.url === 'string' && isSaverUrl(v.url) && typeof v.key === 'string' && v.key.length >= 20)
      return { url: v.url, key: v.key, via: v.via === 'fetch' || v.via === 'frame' ? v.via : '' };
  } catch {
    /* fall through */
  }
  return null;
}

/** Keeps the connection, along with anything else the Worksheet Maker stored with it. */
export function saveConnection(c: SaverConnection): void {
  let prev: Record<string, unknown> = {};
  try {
    prev = JSON.parse(safeStorage.get(CONN_KEY) || '{}') || {};
  } catch {
    prev = {};
  }
  safeStorage.set(CONN_KEY, JSON.stringify({ ...prev, url: c.url, key: c.key, via: c.via || '' }));
}

export function forgetConnection(): void {
  safeStorage.remove(CONN_KEY);
}

function fromBase64Url(s: string): string {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

/** A connection code copied from the Worksheet Maker: "WMS1." and base64url of {"u": address, "k": key}. */
export function parseConnectionCode(code: string): SaverConnection | null {
  const m = code.trim().match(/^WMS1\.([\w-]+)$/);
  if (!m) return null;
  try {
    const j = JSON.parse(fromBase64Url(m[1]));
    if (j && typeof j.u === 'string' && isSaverUrl(j.u) && typeof j.k === 'string' && j.k.length >= 20) return { url: j.u, key: j.k, via: '' };
  } catch {
    /* not a code */
  }
  return null;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** One worksheet from the saver or the local note, checked; null if it isn't usable. */
export function normalise(x: unknown): DriveWorksheet | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const id = str(o.id, 120), url = safeHref(str(o.url, 500)), title = str(o.title, 200) || str(o.name, 200);
  if (!id || !url || !title) return null;
  const at = str(o.at, 40);
  return {
    id,
    url,
    title,
    place: str(o.place, 40),
    label: str(o.label, 120),
    course: str(o.course, 12) || undefined,
    topic: num(o.topic),
    area: str(o.area, 8) || null,
    at: /^\d{4}-\d\d-\d\d/.test(at) ? at : '',
    answers: safeHref(str(o.answers, 500)) ?? null,
    codes: Array.isArray(o.codes) ? o.codes.filter((c): c is string => typeof c === 'string').slice(0, 40) : [],
    count: num(o.count),
    marks: num(o.marks),
  };
}

export function normaliseList(list: unknown): DriveWorksheet[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: DriveWorksheet[] = [];
  for (const x of list) {
    const w = normalise(x);
    if (w && !seen.has(w.id)) {
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

/** Worksheets saved from the Worksheet Maker on this computer (used when the saver can't be reached). */
export function readSaved(): DriveWorksheet[] {
  try {
    return normaliseList(JSON.parse(safeStorage.get(SAVED_KEY) || '[]'));
  } catch {
    return [];
  }
}

/** The course, HSC topics and Year 11 focus areas a lesson covers, from its program items' syllabus content. */
export function lessonFocus(program: Program, itemIds: string[]): LessonFocus {
  const items = program.units.flatMap((u) => u.items);
  const chosen = items.filter((i) => itemIds.includes(i.id));
  const ids = (chosen.length ? chosen : items).flatMap((i) => i.syllabus);
  const course = /\.hsc$/.test(program.courseId) ? 'hsc' : /(y11|prelim|year11)/i.test(program.courseId) ? 'y11' : undefined;
  const topics = [...new Set(ids.map((s) => s.match(/\.t([1-4])(\.|$)/)?.[1]).filter(Boolean).map(Number))];
  const areas = [...new Set(ids.map((s) => s.match(/\.p([1-6])(\.|$)/i)?.[1]).filter(Boolean).map((d) => `P${d}`))];
  return { course, topics, areas };
}

/** Best matches first: the lesson's topic or focus area, then its course, then the newest. */
export function rankWorksheets(list: DriveWorksheet[], focus: LessonFocus, query = ''): DriveWorksheet[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (w: DriveWorksheet) => `${w.title} ${w.label} ${(w.codes ?? []).join(' ')}`.toLowerCase();
  const score = (w: DriveWorksheet) =>
    ((w.topic && focus.topics.includes(w.topic)) || (w.area && focus.areas.includes(w.area)) ? 2 : 0) +
    (focus.course && w.course === focus.course ? 1 : 0);
  return list
    .filter((w) => words.every((x) => hay(w).includes(x)))
    .map((w) => ({ w, s: score(w) }))
    .sort((a, b) => b.s - a.s || (a.w.at < b.w.at ? 1 : a.w.at > b.w.at ? -1 : 0))
    .map((x) => x.w);
}

/** A short name for where a worksheet is kept: "Topic 3", "Year 11 Markets". */
export function placeShort(w: DriveWorksheet): string {
  if (w.course === 'y11') return `Year 11 ${w.label.replace(/^\d+\s*/, '')}`.trim();
  if (w.topic) return `Topic ${w.topic}`;
  return w.label;
}

export const resourceId = (w: DriveWorksheet) => `drive-${w.id}`;

export function toResource(w: DriveWorksheet): AddedResource {
  return { id: resourceId(w), type: 'worksheet', title: w.title, url: w.url, note: w.label || undefined };
}

const MESSAGES: Record<string, string> = {
  'bad-key': 'Your Worksheet saver didn’t accept the key on this device. Connect again with a new connection code from the Worksheet Maker.',
  'no-key': 'Your Worksheet saver has no key yet. Finish setting it up in the Worksheet Maker.',
  timeout:
    'Your Worksheet saver didn’t answer. If it is set up for “Anyone within NSW Department of Education”, this browser has to be signed in to your school Google account.',
  network: 'Google couldn’t be reached. Check the internet connection.',
};

export function saverMessage(e: unknown): string {
  const code = e instanceof SaverError ? e.code : '';
  return MESSAGES[code] ?? `Your saved worksheets couldn’t be loaded${e instanceof Error && e.message && e.message !== code ? ` (${e.message})` : ''}.`;
}

function randomId(): string {
  const a = new Uint8Array(15);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The hidden-frame route, for a saver limited to school accounts: a form posts into a hidden frame and Google's
 *  page inside it answers by postMessage. Only an answer from inside our frame, with our nonce, is taken. */
function frameCall(conn: SaverConnection, body: Record<string, unknown>, timeout: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const nonce = randomId();
    const name = `wmsaver${nonce}`;
    const ifr = document.createElement('iframe');
    ifr.name = name;
    ifr.title = 'Worksheet saver';
    ifr.hidden = true;
    document.body.append(ifr);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = conn.url;
    form.target = name;
    form.acceptCharset = 'UTF-8';
    form.hidden = true;
    const ta = document.createElement('textarea');
    ta.name = 'p';
    ta.value = JSON.stringify({ ...body, key: conn.key, nonce, origin: location.origin });
    form.append(ta);
    document.body.append(form);
    const ours = (src: MessageEventSource | null) => {
      let w = src as Window | null;
      for (let i = 0; i < 12 && w; i++) {
        if (w === ifr.contentWindow) return true;
        let p: Window | null = null;
        try {
          p = w.parent;
        } catch {
          return false;
        }
        if (!p || p === w) return false;
        w = p;
      }
      return false;
    };
    let timer = 0;
    const finish = (ok: boolean, v: unknown) => {
      window.clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      form.remove();
      window.setTimeout(() => ifr.remove(), 0);
      if (ok) resolve(v as Record<string, unknown>);
      else reject(v);
    };
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.worksheetSaver !== 1 || d.nonce !== nonce || !ours(e.source)) return;
      finish(true, d.result ?? { ok: false, error: 'failed' });
    };
    window.addEventListener('message', onMsg);
    timer = window.setTimeout(() => finish(false, new SaverError('timeout')), timeout);
    form.submit();
  });
}

/** Calls the saver: fetch() first (a saver open to Anyone), then the hidden-frame route. Updates conn.via. */
export async function callSaver(conn: SaverConnection, body: Record<string, unknown>, timeout = 60000): Promise<Record<string, unknown>> {
  if (conn.via !== 'frame') {
    let j: unknown = null;
    let status = 0;
    try {
      const r = await fetch(conn.url, { method: 'POST', body: JSON.stringify({ ...body, key: conn.key }), redirect: 'follow' });
      status = r.status;
      try {
        j = JSON.parse(await r.text());
      } catch {
        j = null;
      }
    } catch {
      if (conn.via === 'fetch') throw new SaverError('network');
    }
    if (j && typeof j === 'object') {
      conn.via = 'fetch';
      return j as Record<string, unknown>;
    }
    if (conn.via === 'fetch') throw new SaverError('failed', `Google answered ${status}`);
  }
  const j = await frameCall(conn, body, timeout);
  conn.via = 'frame';
  return j;
}

/** The worksheets in the Worksheets folders, newest first. */
export async function fetchSaved(conn: SaverConnection, timeout = 60000): Promise<DriveWorksheet[]> {
  const j = await callSaver(conn, { action: 'list' }, timeout);
  if (!j.ok) throw new SaverError(typeof j.error === 'string' ? j.error : 'failed', typeof j.message === 'string' ? j.message : undefined);
  return normaliseList(j.items);
}
