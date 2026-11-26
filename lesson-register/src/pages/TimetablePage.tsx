import { useState } from 'react';
import { canLead, useApp } from '../app/context';
import { useClassBundle, type ClassBundle } from '../app/data';
import { go, href } from '../app/router';
import { Disclosure, ErrorBox, Loading } from '../components/ui';
import { generateSlots, slotTime, termFor, WEEKDAYS } from '../lib/calendar';
import type { Timetable, TimetableSlot, Weekday } from '../lib/types';
import { newId, shortDate, toISO, todayISO } from '../lib/util';

export function TimetablePage({ classId }: { classId: string }) {
  const { data, error, loading } = useClassBundle(classId);
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  return <TimetableForm b={data} />;
}

function TimetableForm({ b }: { b: ClassBundle }) {
  const { store, session, faculty, member } = useApp();
  const { cls } = b;
  const mine = cls.teacherId === session?.userId;
  const cal = faculty?.calendar;
  const fortnightly = cal?.cycle === 'fortnightly';
  const today = todayISO();
  const [tt, setTt] = useState<Timetable>(() => {
    const t = structuredClone(cls.timetable ?? { slots: [] });
    // Start from today so a new timetable doesn't open with weeks of lessons to
    // back-fill; move the date earlier to record lessons already taught.
    if (!t.from) t.from = today;
    return t;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const update = (f: (t: Timetable) => void) =>
    setTt((t) => {
      const d = structuredClone(t);
      f(d);
      return d;
    });

  function addSlot() {
    const last = tt.slots.at(-1);
    update((t) =>
      void t.slots.push({
        id: newId(),
        week: fortnightly ? (last?.week ?? 'A') : 'every',
        day: (last ? Math.min(5, last.day + 1) : 1) as Weekday,
        period: '',
        start: last?.start ?? '09:00',
        end: last?.end ?? '10:00',
        room: last?.room ?? '',
      }),
    );
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const bad = tt.slots.find((s) => !s.start || !s.end || s.end <= s.start);
      if (bad) throw new Error('Each lesson needs a start time before its end time.');
      await store.saveClass({ ...cls, timetable: tt });
      go(`/class/${cls.id}/lessons?saved=timetable`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 70);
  const preview = generateSlots(cal, tt, today, toISO(horizon)).slice(0, 6);
  const term = cal ? termFor(cal, today) : undefined;
  const termCount = term ? generateSlots(cal, tt, term.studentsStart, term.end).length : 0;

  return (
    <>
      <a className="back" href={href(`/class/${cls.id}/lessons`)}>
        ← {cls.name}
      </a>
      <div className="pagehead">
        <h1>{cls.name} timetable</h1>
        <p>When and where this class meets. Every lesson in the school calendar is then listed for you to record.</p>
      </div>
      {!cal && (
        <div className="notice">
          The school calendar hasn’t been set up yet.{' '}
          {canLead(member) ? <a href={href('/calendar')}>Set up the calendar</a> : 'Ask your Head Teacher to set it up in Settings.'}
        </div>
      )}
      <ErrorBox error={error} />
      <fieldset disabled={!mine} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        <section className="card" aria-labelledby="slots">
          <h2 id="slots">Lessons each {fortnightly ? 'fortnight' : 'week'}</h2>
          {tt.slots.length === 0 && <p className="muted">No lessons yet. Add one for each time the class meets.</p>}
          {tt.slots.map((s, i) => (
            <SlotEditor
              key={s.id}
              slot={s}
              fortnightly={fortnightly}
              onChange={(ns) => update((t) => void (t.slots[i] = ns))}
              onRemove={() => update((t) => void t.slots.splice(i, 1))}
            />
          ))}
          <button type="button" onClick={addSlot}>
            Add a lesson time
          </button>
        </section>
        <section className="card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="from">
              Use this timetable from <span className="hint">(lessons before this date aren’t listed)</span>
            </label>
            <input id="from" type="date" value={tt.from ?? ''} onChange={(e) => update((t) => void (t.from = e.target.value || undefined))} />
          </div>
        </section>
      </fieldset>
      {cal && tt.slots.length > 0 && (
        <section className="card">
          <h2>Coming up</h2>
          {term && <p className="small muted">{termCount} lessons in {term.name}.</p>}
          <ul className="list">
            {preview.map((p) => (
              <li key={p.key} className="row between">
                <span>
                  <strong>{shortDate(p.date)}</strong> {slotTime(p)}
                </span>
                <span className="small muted">
                  {p.room}
                  {p.ab ? ` · Week ${p.ab}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {preview.length === 0 && <p className="muted small">No lessons in the next ten weeks (school holidays?).</p>}
        </section>
      )}
      {mine && (
        <div className="sticky-save">
          <button type="button" className="primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save timetable'}
          </button>
        </div>
      )}
    </>
  );
}

function SlotEditor({
  slot,
  fortnightly,
  onChange,
  onRemove,
}: {
  slot: TimetableSlot;
  fortnightly: boolean;
  onChange: (s: TimetableSlot) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof TimetableSlot>(k: K, v: TimetableSlot[K]) => onChange({ ...slot, [k]: v });
  const id = slot.id;
  const day = WEEKDAYS.find((d) => d.value === slot.day)?.label ?? '';
  return (
    <Disclosure className="slot-edit" startOpen={!slot.period}>
      <summary>
        {fortnightly && slot.week !== 'every' ? `Week ${slot.week} · ` : ''}
        {day} {slotTime(slot)}
        {slot.room ? ` · ${slot.room}` : ''}
      </summary>
      <div className="grid-2">
        {fortnightly && (
          <div className="field">
            <label htmlFor={`w-${id}`}>Week</label>
            <select id={`w-${id}`} value={slot.week} onChange={(e) => set('week', e.target.value as TimetableSlot['week'])}>
              <option value="A">Week A</option>
              <option value="B">Week B</option>
              <option value="every">Every week</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor={`d-${id}`}>Day</label>
          <select id={`d-${id}`} value={slot.day} onChange={(e) => set('day', Number(e.target.value) as Weekday)}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`p-${id}`}>Period</label>
          <input id={`p-${id}`} type="text" placeholder="e.g. P3" value={slot.period} onChange={(e) => set('period', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`r-${id}`}>Room</label>
          <input id={`r-${id}`} type="text" placeholder="e.g. H12" value={slot.room} onChange={(e) => set('room', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`s-${id}`}>Starts</label>
          <input id={`s-${id}`} type="time" value={slot.start} onChange={(e) => set('start', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`e-${id}`}>Ends</label>
          <input id={`e-${id}`} type="time" value={slot.end} onChange={(e) => set('end', e.target.value)} />
        </div>
      </div>
      <button type="button" className="danger" onClick={onRemove}>
        Remove this lesson time
      </button>
    </Disclosure>
  );
}
