import { useEffect, useMemo, useState } from 'react';
import type { AddedResource } from '../lib/types';
import {
  fetchSaved,
  forgetConnection,
  parseConnectionCode,
  placeShort,
  rankWorksheets,
  readConnection,
  readSaved,
  resourceId,
  saveConnection,
  saverMessage,
  toResource,
  type DriveWorksheet,
  type LessonFocus,
  type SaverConnection,
} from '../lib/worksheets';
import { longDate } from '../lib/util';
import { SrOnly } from './ui';

// One list per page load, so moving between lesson records doesn't ask Google again for a few minutes.
let cache: { url: string; at: number; items: DriveWorksheet[] } | null = null;
const FRESH = 3 * 60 * 1000;
const SHOW = 8;

type Load = { status: 'loading' | 'ready' | 'error'; items: DriveWorksheet[]; error?: string; local: boolean };

/** Worksheets saved to Google Drive from the Worksheet Maker, to add to a lesson's resources. */
export function WorksheetPicker({ focus, added, onAdd }: { focus: LessonFocus; added: AddedResource[]; onAdd: (r: AddedResource) => void }) {
  const [conn, setConn] = useState<SaverConnection | null>(() => readConnection());
  const local = useMemo(() => readSaved(), []);
  const [load, setLoad] = useState<Load>(() =>
    conn ? (cache && cache.url === conn.url && Date.now() - cache.at < FRESH ? { status: 'ready', items: cache.items, local: false } : { status: 'loading', items: [], local: false }) : { status: 'ready', items: local, local: true },
  );
  const [nonce, setNonce] = useState(0);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState('');

  useEffect(() => {
    if (!conn) return;
    if (!nonce && cache && cache.url === conn.url && Date.now() - cache.at < FRESH) return;
    let live = true;
    setLoad((l) => ({ ...l, status: 'loading' }));
    const was = conn.via;
    fetchSaved(conn)
      .then((items) => {
        if (conn.via !== was) saveConnection(conn);
        cache = { url: conn.url, at: Date.now(), items };
        if (live) setLoad({ status: 'ready', items, local: false });
      })
      .catch((e) => {
        if (live) setLoad({ status: 'error', items: local, error: saverMessage(e), local: true });
      });
    return () => {
      live = false;
    };
  }, [conn, nonce, local]);

  const taken = new Set(added.map((r) => r.id));
  const ranked = useMemo(() => rankWorksheets(load.items, focus, query), [load.items, focus, query]);
  const open = ranked.filter((w) => !taken.has(resourceId(w)));
  const shown = all || query ? open.slice(0, 60) : open.slice(0, SHOW);

  function connect() {
    const c = parseConnectionCode(code);
    if (!c) {
      setCodeMsg('That code couldn’t be read. Copy it again from the Worksheet Maker: it starts with WMS1.');
      return;
    }
    saveConnection(c);
    cache = null;
    setCode('');
    setCodeMsg('');
    setConn(readConnection());
  }

  function disconnect() {
    forgetConnection();
    cache = null;
    setConn(null);
    setLoad({ status: 'ready', items: local, local: true });
  }

  if (!conn && !local.length)
    return (
      <details style={{ marginTop: '0.75rem' }}>
        <summary>Worksheets from the Worksheet Maker</summary>
        <p className="small muted">
          Worksheets you save to Google Drive from the HSC Economics Worksheet Maker can be picked here. On the computer where you set up
          “Save to Google Drive” this works by itself. On another device, paste the connection code from the Worksheet Maker (Save to Google
          Drive › Drive settings › Copy a connection code).
        </p>
        <div className="field">
          <label htmlFor="wm-code">Connection code</label>
          <input id="wm-code" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="WMS1.…" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <button type="button" disabled={!code.trim()} onClick={connect}>
          Connect
        </button>
        {codeMsg && (
          <p className="small" role="status">
            {codeMsg}
          </p>
        )}
      </details>
    );

  return (
    <div className="wm-picker" style={{ marginTop: '0.75rem' }}>
      <h3>From the Worksheet Maker</h3>
      <p className="small muted" role="status">
        {load.status === 'loading'
          ? 'Loading your worksheets from Google Drive…'
          : load.status === 'error'
            ? `${load.error} ${load.items.length ? 'Showing the worksheets saved from this computer.' : ''}`
            : load.local
              ? 'Worksheets saved to Google Drive from this computer.'
              : load.items.length
                ? 'Saved to Google Drive. Best matches for this lesson first.'
                : ''}
      </p>
      {load.items.length > SHOW && (
        <div className="field">
          <label htmlFor="wm-q">
            <SrOnly>Search your worksheets</SrOnly>
          </label>
          <input id="wm-q" type="search" placeholder="Search your worksheets" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      {shown.length > 0 && (
        <div className="chips">
          {shown.map((w) => (
            <button
              key={w.id}
              type="button"
              className="chip"
              title={`${w.label}${w.at ? ` · saved ${longDate(w.at.slice(0, 10))}` : ''}${w.count ? ` · ${w.count} questions` : ''}`}
              onClick={() => onAdd(toResource(w))}
            >
              + {w.title} <span className="small muted">· {placeShort(w)}</span>
            </button>
          ))}
        </div>
      )}
      {load.status !== 'loading' && !open.length && (
        <p className="small muted">
          {query
            ? 'No saved worksheets match that.'
            : load.items.length
              ? 'All your saved worksheets are already in this lesson.'
              : 'No worksheets saved to Google Drive yet. In the Worksheet Maker, use Layout and print › Save to Google Drive.'}
        </p>
      )}
      <div className="row" style={{ gap: '0.5rem', marginTop: '0.4rem' }}>
        {!all && !query && open.length > SHOW && (
          <button type="button" className="quiet" onClick={() => setAll(true)}>
            Show all {open.length}
          </button>
        )}
        {conn && (
          <button type="button" className="quiet" disabled={load.status === 'loading'} onClick={() => setNonce((n) => n + 1)}>
            Refresh
          </button>
        )}
        {conn && (
          <button type="button" className="quiet" title="Removes the Worksheet saver connection from this browser, for the Worksheet Maker too" onClick={disconnect}>
            Disconnect this browser
          </button>
        )}
      </div>
    </div>
  );
}
