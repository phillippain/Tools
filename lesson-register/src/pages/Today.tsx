import { useState } from 'react';
import { useApp, useAsync } from '../app/context';
import { asPlannedLesson, loadClassBundle, type ClassBundle } from '../app/data';
import { href } from '../app/router';
import { Bar, ErrorBox, Loading, useToast } from '../components/ui';
import { coverage, coveragePercent, itemProgress, nextItem } from '../lib/progress';
import { itemLabel } from '../lib/program';
import { longDate, plural, shortDate, todayISO } from '../lib/util';
import { slotsWithRecords, slotTime, weekLabel } from '../lib/calendar';

export function Today() {
  const { store, member } = useApp();
  const [toast, say] = useToast();
  const { data, error, loading, reload } = useAsync(async () => {
    const classes = await store.listClasses(member!.facultyId, 'mine');
    return Promise.all(classes.map((c) => loadClassBundle(store, c.id)));
  }, [store, member?.facultyId]);

  const today = todayISO();
  const { faculty } = useApp();
  const cal = faculty?.calendar;
  return (
    <>
      <div className="pagehead">
        <div className="eyebrow">
          {longDate(today)}
          {cal ? ` · ${weekLabel(cal, today)}` : ''}
        </div>
        <h1>Today</h1>
        <p>Record what you taught. Tap “As planned” when nothing changed.</p>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 && (
        <div className="card">
          <h2>Add your first class</h2>
          <p className="muted">Pick a program for the class and you can start recording lessons straight away.</p>
          <a className="btn primary" href={href('/classes?add=1')}>
            Add a class
          </a>
        </div>
      )}
      {data?.map((b) => <ClassCard key={b.cls.id} bundle={b} onSaved={(m) => (say(m), reload())} />)}
      {toast}
    </>
  );
}

function ClassCard({ bundle, onSaved }: { bundle: ClassBundle; onSaved: (msg: string) => void }) {
  const { store, faculty } = useApp();
  const { cls, program, lessons } = bundle;
  const today = todayISO();
  const { past } = slotsWithRecords(faculty?.calendar, cls.timetable, lessons, today);
  const todays = past.filter((p) => p.slot.date === today);
  const toRecord = past.filter((p) => !p.lesson);
  const nextOpen = todays.find((p) => !p.lesson) ?? toRecord.at(-1);
  const prog = itemProgress(program, lessons);
  const next = nextItem(program, prog);
  const last = [...lessons].sort((a, b) => b.date.localeCompare(a.date))[0];
  const pct = coveragePercent(coverage(program, lessons));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function quick() {
    if (!next || busy) return;
    setBusy(true);
    setErr(undefined);
    const l = asPlannedLesson(cls.id, next.item);
    if (nextOpen) {
      l.date = nextOpen.slot.date;
      l.slot = { key: nextOpen.slot.key, start: nextOpen.slot.start, end: nextOpen.slot.end, period: nextOpen.slot.period };
      l.room = nextOpen.slot.room;
    }
    try {
      await store.saveLesson(l);
      const when = nextOpen ? ` for ${shortDate(nextOpen.slot.date)} ${nextOpen.slot.period}` : '';
      onSaved(`Saved${when}: ${next.item.code ?? ''} ${next.item.title}`.replace(/\s+/g, ' ').trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby={`c-${cls.id}`}>
      <div className="row between">
        <h2 id={`c-${cls.id}`} style={{ margin: 0 }}>
          <a href={href(`/class/${cls.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>
            {cls.name}
          </a>
        </h2>
        <span className="badge">{program.subject}</span>
      </div>
      <p className="muted small" style={{ marginTop: '0.2rem' }}>
        {program.title}
      </p>
      {(todays.length > 0 || toRecord.length > 0) && (
        <div className="row" style={{ marginTop: '0.5rem', gap: '0.35rem' }}>
          {todays.map((p) => (
            <span key={p.slot.key} className={`badge ${p.lesson ? 'done' : 'brand'}`}>
              Today {slotTime(p.slot)}
              {p.slot.room ? ` · ${p.slot.room}` : ''}
              {p.lesson ? ' ✓' : ''}
            </span>
          ))}
          {toRecord.length > 0 && <span className="badge poor">{plural(toRecord.length, 'lesson')} to record</span>}
        </div>
      )}
      {next ? (
        <div className="notice" style={{ marginTop: '0.6rem' }}>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            {prog.get(next.item.id)?.status === 'in-progress' ? 'Continuing' : 'Up next'}
          </div>
          <strong>{itemLabel(next)}</strong>
          {next.unit.timing && <div className="small muted">Planned for {next.unit.timing}</div>}
        </div>
      ) : (
        <p className="badge done">Program finished</p>
      )}
      <div className="row" style={{ marginTop: '0.75rem' }}>
        <a className="btn primary" href={href(`/class/${cls.id}/record${nextOpen ? `?slot=${encodeURIComponent(nextOpen.slot.key)}` : ''}`)}>
          Record lesson
        </a>
        {next?.item.kind === 'lesson' && (
          <button type="button" onClick={quick} disabled={busy}>
            As planned
          </button>
        )}
        <a className="btn" href={href(`/class/${cls.id}`)}>
          Progress
        </a>
      </div>
      <ErrorBox error={err} />
      <div style={{ marginTop: '0.8rem' }}>
        <div className="row between small muted">
          <span>Syllabus content taught</span>
          <span>{pct}%</span>
        </div>
        <Bar value={pct} label={`${pct}% of planned syllabus content taught`} />
        {last && <p className="small muted" style={{ marginTop: '0.4rem' }}>Last record: {shortDate(last.date)}</p>}
      </div>
    </section>
  );
}
