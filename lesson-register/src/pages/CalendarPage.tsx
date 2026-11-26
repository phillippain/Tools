import { useState } from 'react';
import { canLead, useApp } from '../app/context';
import { href } from '../app/router';
import { ErrorBox, Segmented, useToast } from '../components/ui';
import { NSW_PUBLIC_CALENDAR } from '../lib/calendar';
import type { SchoolCalendar, Term } from '../lib/types';
import { longDate, newId } from '../lib/util';

const EMPTY: SchoolCalendar = { cycle: 'fortnightly', terms: [], days: [] };

export function CalendarPage() {
  const { store, faculty, member, reload } = useApp();
  const editable = canLead(member);
  const [cal, setCal] = useState<SchoolCalendar>(() => structuredClone(faculty?.calendar ?? EMPTY));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [toast, say] = useToast();
  const [newDay, setNewDay] = useState({ date: '', label: '' });

  const update = (f: (c: SchoolCalendar) => void) =>
    setCal((c) => {
      const d = structuredClone(c);
      f(d);
      return d;
    });

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const problems = cal.terms.filter((t) => !t.start || !t.end || !t.studentsStart || t.studentsStart < t.start || t.end < t.studentsStart);
      if (problems.length) throw new Error(`Check the dates for ${problems.map((t) => t.name || 'a term').join(', ')}.`);
      const clean = structuredClone(cal);
      clean.terms.sort((a, b) => a.start.localeCompare(b.start));
      clean.days.sort((a, b) => a.date.localeCompare(b.date));
      await store.saveCalendar(faculty!.id, clean);
      setCal(clean);
      say('Calendar saved');
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="back" href={href('/settings')}>
        ← Settings
      </a>
      <div className="pagehead">
        <h1>School calendar</h1>
        <p>Term dates and days without classes. Class timetables use these to list each lesson.</p>
      </div>
      {!editable && <div className="notice">Head Teachers and admins can change the calendar.</div>}
      <ErrorBox error={error} />
      {editable && (
        <section className="card">
          <h2>Start from NSW public school dates</h2>
          <p className="small">
            Term 4 2026 and all of 2027 for the Eastern division, with Good Friday, Easter Monday and the King’s Birthday. Catholic and independent
            schools set their own dates, so check your school calendar.
          </p>
          <button type="button" onClick={() => setCal(structuredClone(NSW_PUBLIC_CALENDAR))}>
            Fill in NSW public school dates
          </button>
        </section>
      )}
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0 }}>
        <section className="card">
          <Segmented
            legend="Timetable cycle"
            name="cycle"
            value={cal.cycle}
            options={[
              { value: 'weekly', label: 'Same every week' },
              { value: 'fortnightly', label: 'Week A and Week B' },
            ]}
            onChange={(v) => v && update((c) => void (c.cycle = v))}
          />
        </section>

        <section className="card" aria-labelledby="terms">
          <h2 id="terms">Terms</h2>
          {cal.terms.length === 0 && <p className="muted">No terms yet.</p>}
          {cal.terms.map((t, i) => (
            <TermEditor
              key={t.id}
              term={t}
              fortnightly={cal.cycle === 'fortnightly'}
              onChange={(nt) => update((c) => void (c.terms[i] = nt))}
              onRemove={() => update((c) => void c.terms.splice(i, 1))}
            />
          ))}
          <button
            type="button"
            onClick={() => update((c) => void c.terms.push({ id: newId(), name: `Term ${c.terms.length + 1}`, start: '', studentsStart: '', end: '', firstWeek: 'A' }))}
          >
            Add a term
          </button>
        </section>

        <section className="card" aria-labelledby="days">
          <h2 id="days">Days without classes</h2>
          <p className="small muted">Public holidays and other student-free days that fall inside a term. Development days before students start are already left out.</p>
          <ul className="list">
            {cal.days.map((d, i) => (
              <li key={d.date + i} className="row between">
                <span>
                  <strong>{longDate(d.date)}</strong> · {d.label}
                </span>
                <button type="button" className="quiet" onClick={() => update((c) => void c.days.splice(i, 1))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, flex: '1 1 9rem' }}>
              <label htmlFor="nd-date">Date</label>
              <input id="nd-date" type="date" value={newDay.date} onChange={(e) => setNewDay({ ...newDay, date: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: '2 1 12rem' }}>
              <label htmlFor="nd-label">What it is</label>
              <input id="nd-label" type="text" placeholder="e.g. Athletics carnival" value={newDay.label} onChange={(e) => setNewDay({ ...newDay, label: e.target.value })} />
            </div>
            <button
              type="button"
              disabled={!newDay.date || !newDay.label.trim()}
              onClick={() => {
                update((c) => void c.days.push({ date: newDay.date, label: newDay.label.trim() }));
                setNewDay({ date: '', label: '' });
              }}
            >
              Add day
            </button>
          </div>
        </section>
      </fieldset>
      {editable && (
        <div className="sticky-save">
          <button type="button" className="primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save calendar'}
          </button>
        </div>
      )}
      {toast}
    </>
  );
}

function TermEditor({ term, fortnightly, onChange, onRemove }: { term: Term; fortnightly: boolean; onChange: (t: Term) => void; onRemove: () => void }) {
  const set = (k: keyof Term, v: string) => onChange({ ...term, [k]: v });
  const id = term.id;
  return (
    <details className="term-edit">
      <summary>
        {term.name || 'New term'}
        {term.studentsStart && term.end && (
          <span className="small muted" style={{ fontWeight: 400 }}>
            {' '}
            · {longDate(term.studentsStart)} to {longDate(term.end)}
          </span>
        )}
      </summary>
      <div className="field">
        <label htmlFor={`tn-${id}`}>Name</label>
        <input id={`tn-${id}`} type="text" value={term.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`ts-${id}`}>
            Term starts <span className="hint">(staff; sets Week 1)</span>
          </label>
          <input id={`ts-${id}`} type="date" value={term.start} onChange={(e) => set('start', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`tss-${id}`}>Students start</label>
          <input id={`tss-${id}`} type="date" value={term.studentsStart} onChange={(e) => set('studentsStart', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`te-${id}`}>Last day for students</label>
          <input id={`te-${id}`} type="date" value={term.end} onChange={(e) => set('end', e.target.value)} />
        </div>
        {fortnightly && (
          <div className="field">
            <label htmlFor={`tw-${id}`}>Week 1 is</label>
            <select id={`tw-${id}`} value={term.firstWeek} onChange={(e) => set('firstWeek', e.target.value)}>
              <option value="A">Week A</option>
              <option value="B">Week B</option>
            </select>
          </div>
        )}
      </div>
      <button type="button" className="danger" onClick={onRemove}>
        Remove term
      </button>
    </details>
  );
}
