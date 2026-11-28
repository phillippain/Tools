import { describe, expect, it } from 'vitest';
import { ecoT34Program } from '../data/programs/eco-t34-2027';
import {
  CONN_KEY,
  SAVED_KEY,
  forgetConnection,
  isSaverUrl,
  lessonFocus,
  normalise,
  normaliseList,
  parseConnectionCode,
  placeShort,
  rankWorksheets,
  readConnection,
  readSaved,
  saveConnection,
  saverMessage,
  SaverError,
  toResource,
  type DriveWorksheet,
} from '../lib/worksheets';
import { safeStorage } from '../lib/util';

const URL1 = 'https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec';
const KEY = 'k_' + 'x'.repeat(30);
// The Worksheet Maker makes codes with btoa(unescape(encodeURIComponent(JSON))) as base64url without padding.
const makerCode = (u: string, k: string) => 'WMS1.' + Buffer.from(JSON.stringify({ u, k })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ws = (o: Partial<DriveWorksheet>): DriveWorksheet => ({ id: 'f1', url: 'https://drive.google.com/file/d/f1/view', title: 'A', place: 'hsc-t3', label: 'Topic 3 Economic Issues', course: 'hsc', topic: 3, area: null, at: '2026-11-20T01:00:00.000Z', ...o });

describe('Worksheet Maker connection', () => {
  it('accepts Apps Script web app addresses only', () => {
    expect(isSaverUrl(URL1)).toBe(true);
    expect(isSaverUrl('https://script.google.com/a/macros/education.nsw.gov.au/s/AKfycbx1234567890abcdefghijklmnop/exec')).toBe(true);
    expect(isSaverUrl('https://evil.example/macros/s/AKfycbx1234567890abcdefghijklmnop/exec')).toBe(false);
    expect(isSaverUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/dev')).toBe(false);
  });

  it('reads a connection code made by the Worksheet Maker', () => {
    expect(parseConnectionCode(makerCode(URL1, KEY))).toEqual({ url: URL1, key: KEY, via: '' });
    expect(parseConnectionCode('  ' + makerCode(URL1, KEY) + '\n')).toEqual({ url: URL1, key: KEY, via: '' });
    expect(parseConnectionCode('WMS1.notbase64!!')).toBeNull();
    expect(parseConnectionCode(makerCode('https://evil.example/x/exec', KEY))).toBeNull();
    expect(parseConnectionCode(makerCode(URL1, 'short'))).toBeNull();
    expect(parseConnectionCode('hello')).toBeNull();
  });

  it('keeps what the Worksheet Maker stored alongside the connection', () => {
    safeStorage.set(CONN_KEY, JSON.stringify({ url: '', key: KEY, user: 'me@x', places: [{ id: 'hsc-t1' }] }));
    expect(readConnection()).toBeNull(); // no address yet
    saveConnection({ url: URL1, key: KEY, via: 'frame' });
    expect(readConnection()).toEqual({ url: URL1, key: KEY, via: 'frame' });
    expect(JSON.parse(safeStorage.get(CONN_KEY) || '{}').places).toEqual([{ id: 'hsc-t1' }]);
    forgetConnection();
    expect(readConnection()).toBeNull();
  });
});

describe('saved worksheets', () => {
  it('drops entries that are not safe or complete, and repeats', () => {
    const list = normaliseList([
      ws({}),
      ws({}),
      { ...ws({ id: 'f2' }), url: 'javascript:alert(1)' },
      { id: 'f3', url: 'https://drive.google.com/file/d/f3/view', title: '' },
      { id: 'f4', url: 'https://drive.google.com/file/d/f4/view', name: 'From the name', codes: ['3C.1', 7] },
      null,
      'x',
    ]);
    expect(list.map((w) => w.id)).toEqual(['f1', 'f4']);
    expect(list[1].title).toBe('From the name');
    expect(list[1].codes).toEqual(['3C.1']);
    expect(normalise({ ...ws({}), answers: 'data:text/html,x' })?.answers).toBeNull();
  });

  it('reads the note the Worksheet Maker keeps on this computer', () => {
    safeStorage.set(SAVED_KEY, JSON.stringify([ws({ id: 'a' }), ws({ id: 'b', url: 'nope' })]));
    expect(readSaved().map((w) => w.id)).toEqual(['a']);
    safeStorage.set(SAVED_KEY, '{broken');
    expect(readSaved()).toEqual([]);
  });

  it('works out a lesson’s course and topics from its program items', () => {
    const items = ecoT34Program.units.flatMap((u) => u.items);
    const t4 = items.find((i) => i.syllabus.some((s) => s.includes('.t4.')))!;
    expect(lessonFocus(ecoT34Program, [t4.id])).toMatchObject({ course: 'hsc', topics: [4] });
    expect(lessonFocus(ecoT34Program, []).topics.sort()).toEqual([3, 4]);
  });

  it('ranks the lesson’s topic first, then its course, then the newest', () => {
    const list = [
      ws({ id: 'old-t3', topic: 3, at: '2026-10-01T00:00:00Z' }),
      ws({ id: 'new-t4', topic: 4, at: '2026-11-25T00:00:00Z' }),
      ws({ id: 'y11', course: 'y11', topic: null, area: 'P2', label: '02 Markets', place: 'y11-p2', at: '2026-11-27T00:00:00Z' }),
      ws({ id: 'new-t3', topic: 3, at: '2026-11-21T00:00:00Z', title: 'Inflation practice', codes: ['3C.2'] }),
    ];
    expect(rankWorksheets(list, { course: 'hsc', topics: [3], areas: [] }).map((w) => w.id)).toEqual(['new-t3', 'old-t3', 'new-t4', 'y11']);
    expect(rankWorksheets(list, { course: 'y11', topics: [], areas: ['P2'] })[0].id).toBe('y11');
    expect(rankWorksheets(list, { topics: [], areas: [] }, 'inflation 3c.2').map((w) => w.id)).toEqual(['new-t3']);
  });

  it('becomes a Worksheet resource with its Drive link', () => {
    const w = ws({ id: 'abc', title: 'Inflation practice' });
    expect(toResource(w)).toEqual({ id: 'drive-abc', type: 'worksheet', title: 'Inflation practice', url: w.url, note: 'Topic 3 Economic Issues' });
    expect(placeShort(w)).toBe('Topic 3');
    expect(placeShort(ws({ course: 'y11', topic: null, label: '02 Markets' }))).toBe('Year 11 Markets');
  });

  it('explains saver problems in plain words', () => {
    expect(saverMessage(new SaverError('bad-key'))).toMatch(/didn’t accept the key/);
    expect(saverMessage(new SaverError('failed', 'Google answered 500'))).toMatch(/\(Google answered 500\)/);
  });
});
