// Student names never leave this device. The server only ever sees codes such
// as "S07". Names are kept in this browser's storage, keyed by class, and are
// merged into a download on the device when the teacher asks for them.

import { safeStorage } from './util';

export type Roster = Record<string, string>; // code -> name

const key = (classId: string) => `lr.roster.${classId}`;

export function getRoster(classId: string): Roster {
  const raw = safeStorage.get(key(classId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Roster) : {};
  } catch {
    return {};
  }
}

export function setRoster(classId: string, roster: Roster): void {
  const clean: Roster = {};
  for (const [code, name] of Object.entries(roster)) if (name.trim()) clean[code] = name.trim();
  if (Object.keys(clean).length === 0) safeStorage.remove(key(classId));
  else safeStorage.set(key(classId), JSON.stringify(clean));
}

export function hasRoster(classId: string): boolean {
  return Object.keys(getRoster(classId)).length > 0;
}

/** "Sam Lee (S07)" when the name is on this device, otherwise "S07". */
export function displayStudent(code: string, roster: Roster): string {
  const name = roster[code];
  return name ? `${name} (${code})` : code;
}

/** A roster file the teacher can keep in their school drive and load on another device. */
export function rosterFile(roster: Roster): Blob {
  const lines = ['code,name', ...Object.entries(roster).map(([c, n]) => `${c},"${n.replace(/"/g, '""')}"`)];
  return new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
}

export function parseRosterCsv(text: string): Roster {
  const out: Roster = {};
  for (const line of text.split(/\r?\n/).slice(1)) {
    const m = line.match(/^\s*([^,]+)\s*,\s*"?(.*?)"?\s*$/);
    if (!m) continue;
    const code = m[1].trim();
    const name = m[2].replace(/""/g, '"').trim();
    if (code && name) out[code] = name;
  }
  return out;
}
