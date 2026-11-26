import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export function Segmented<T extends string>(props: {
  legend: string;
  hideLegend?: boolean;
  name: string;
  value: T | undefined;
  options: { value: T; label: string; tone?: string }[];
  onChange: (v: T | undefined) => void;
  allowClear?: boolean;
}) {
  const { legend, name, value, options, onChange, allowClear, hideLegend } = props;
  return (
    <fieldset className="seg">
      <legend className={hideLegend ? 'sr-only' : undefined} style={hideLegend ? srOnly : undefined}>
        {legend}
      </legend>
      <div className="opts">
        {options.map((o) => (
          <label key={o.value} className={o.tone ?? 'neutral'}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              onClick={() => {
                // Tapping the chosen option again clears it, where clearing is allowed.
                if (allowClear && value === o.value) onChange(undefined);
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const srOnly: CSSProperties = {
  position: 'absolute',
  clipPath: 'inset(50%)',
  width: 1,
  height: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  margin: -1,
};

export function SrOnly({ children }: { children: ReactNode }) {
  return <span style={srOnly}>{children}</span>;
}

/** Native modal dialog. The browser handles focus, Esc and the back gesture. */
export function Dialog(props: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={props.onClose}>
      <div className="dlg-head">
        <h1 id={titleId}>{props.title}</h1>
        <button type="button" className="quiet" onClick={props.onClose}>
          Close
        </button>
      </div>
      <div className="dlg-body">{props.open ? props.children : null}</div>
    </dialog>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      {error}
    </div>
  );
}

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="bar" role="img" aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
  return [node, setMsg];
}

type DownloadsApi = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };

async function previewDownloads(): Promise<DownloadsApi | null> {
  const host = (window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
  if (!host?.use) return null;
  try {
    return (await host.use('downloads')) as DownloadsApi | null;
  } catch {
    return null;
  }
}

/** Save a generated file. Inside the preview frame this goes through the host's download prompt. */
export async function download(blob: Blob, name: string): Promise<void> {
  if (__PREVIEW__) {
    const api = await previewDownloads();
    if (api) {
      try {
        await api.save({ filename: name, data: blob });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        if (code !== 'declined') throw new Error('This preview can’t save files here. Open it in a browser on a computer to try the download.');
      }
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const Icon = {
  today: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M8.5 14.5l2.2 2.2 4.8-4.8" />
    </svg>
  ),
  classes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.5" />
      <path d="M2.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M13.5 15.2c.9-.8 1.9-1.2 3-1.2 2.3 0 4.1 1.7 4.6 4.5" />
    </svg>
  ),
  programs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 3.5h10l4 4v13H5z" />
      <path d="M15 3.5v4h4M8.5 12h7M8.5 15.5h7M8.5 8.5h3" />
    </svg>
  ),
  faculty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 20.5h18M5 20.5V9l7-5 7 5v11.5" />
      <path d="M9.5 20.5v-6h5v6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
};

/** A <details> that starts open or closed, then stays however the reader leaves it
 *  (an `open` prop that follows the data would snap shut while someone is typing). */
export function Disclosure({ startOpen, className, children }: { startOpen: boolean; className?: string; children: ReactNode }) {
  const [open] = useState(startOpen);
  return (
    <details className={className} open={open}>
      {children}
    </details>
  );
}
