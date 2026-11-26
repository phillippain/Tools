import type { LessonRecord, LessonSlot, NonTeachingDay, SchoolCalendar, Term, Timetable, TimetableSlot } from './types';
import { fromISO, toISO } from './util';

/**
 * NSW public schools, Eastern division (NSW Department of Education calendars).
 * Term 4 2026 and the 2027 school year. Each school can edit these: Catholic and
 * independent schools set their own dates.
 */
export const NSW_PUBLIC_CALENDAR: SchoolCalendar = {
  cycle: 'fortnightly',
  source: 'NSW Department of Education term dates, Eastern division (Term 4 2026 to Term 4 2027)',
  terms: [
    { id: 't4-2026', name: 'Term 4 2026', start: '2026-10-12', studentsStart: '2026-10-13', end: '2026-12-17', firstWeek: 'A' },
    { id: 't1-2027', name: 'Term 1 2027', start: '2027-01-28', studentsStart: '2027-02-03', end: '2027-04-09', firstWeek: 'A' },
    { id: 't2-2027', name: 'Term 2 2027', start: '2027-04-27', studentsStart: '2027-04-29', end: '2027-07-02', firstWeek: 'A' },
    { id: 't3-2027', name: 'Term 3 2027', start: '2027-07-19', studentsStart: '2027-07-20', end: '2027-09-24', firstWeek: 'A' },
    { id: 't4-2027', name: 'Term 4 2027', start: '2027-10-11', studentsStart: '2027-10-11', end: '2027-12-17', firstWeek: 'A' },
  ],
  days: [
    { date: '2027-03-26', label: 'Good Friday' },
    { date: '2027-03-29', label: 'Easter Monday' },
    { date: '2027-06-14', label: 'King’s Birthday' },
  ],
};

const DAY_MS = 86400000;

function mondayOf(iso: string): Date {
  const d = fromISO(iso);
  const wd = d.getDay(); // 0 Sun .. 6 Sat
  d.setDate(d.getDate() - ((wd + 6) % 7));
  return d;
}

export function termFor(cal: SchoolCalendar, date: string): Term | undefined {
  return cal.terms.find((t) => date >= t.start && date <= t.end);
}

/** Week of term, counted from the week the term starts for staff (as NSW schools number them). */
export function weekOfTerm(term: Term, date: string): number {
  const diff = Math.round((mondayOf(date).getTime() - mondayOf(term.start).getTime()) / DAY_MS);
  return Math.floor(diff / 7) + 1;
}

export function abWeek(cal: SchoolCalendar, term: Term, week: number): 'A' | 'B' | undefined {
  if (cal.cycle !== 'fortnightly') return undefined;
  const odd = week % 2 === 1;
  return odd ? term.firstWeek : term.firstWeek === 'A' ? 'B' : 'A';
}

export function nonTeachingDay(cal: SchoolCalendar, date: string): NonTeachingDay | undefined {
  return cal.days.find((d) => d.date === date);
}

/** A day students are at school: inside a term, a weekday, and not a listed holiday. */
export function isTeachingDay(cal: SchoolCalendar, date: string): boolean {
  const t = termFor(cal, date);
  if (!t || date < t.studentsStart) return false;
  const wd = fromISO(date).getDay();
  if (wd === 0 || wd === 6) return false;
  return !nonTeachingDay(cal, date);
}

/** "Term 1 2027, Week 3 (A)" */
export function weekLabel(cal: SchoolCalendar, date: string): string {
  const t = termFor(cal, date);
  if (!t) return 'School holidays';
  const w = weekOfTerm(t, date);
  const ab = abWeek(cal, t, w);
  return `${t.name}, Week ${w}${ab ? ` (${ab})` : ''}`;
}

export function slotMatches(slot: TimetableSlot, weekday: number, ab: 'A' | 'B' | undefined): boolean {
  if (slot.day !== weekday) return false;
  if (slot.week === 'every') return true;
  return ab === undefined ? true : slot.week === ab;
}

/** Every timetabled lesson between two dates (inclusive). */
export function generateSlots(cal: SchoolCalendar | undefined, tt: Timetable | undefined, from: string, to: string): LessonSlot[] {
  if (!cal || !tt || tt.slots.length === 0) return [];
  const start = tt.from && tt.from > from ? tt.from : from;
  const out: LessonSlot[] = [];
  const d = fromISO(start);
  const end = fromISO(to);
  while (d <= end) {
    const iso = toISO(d);
    if (isTeachingDay(cal, iso)) {
      const term = termFor(cal, iso)!;
      const week = weekOfTerm(term, iso);
      const ab = abWeek(cal, term, week);
      const wd = d.getDay();
      for (const s of tt.slots)
        if (slotMatches(s, wd, ab))
          out.push({
            key: `${iso}|${s.id}`,
            slotId: s.id,
            date: iso,
            start: s.start,
            end: s.end,
            period: s.period,
            room: s.room,
            term: term.name,
            week,
            ab,
          });
    }
    d.setDate(d.getDate() + 1);
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

/** First day the class timetable applies: its own start, else the start of the current term. */
export function timetableStart(cal: SchoolCalendar | undefined, tt: Timetable | undefined, today: string): string {
  if (tt?.from) return tt.from;
  const t = cal ? termFor(cal, today) : undefined;
  return t?.studentsStart ?? today;
}

export interface SlotStatus {
  slot: LessonSlot;
  lesson?: LessonRecord;
}

/** Timetabled lessons up to a date, each with the record made for it (if any). */
export function slotsWithRecords(
  cal: SchoolCalendar | undefined,
  tt: Timetable | undefined,
  lessons: LessonRecord[],
  today: string,
  upcoming = 0,
): { past: SlotStatus[]; next: LessonSlot[] } {
  if (!cal || !tt || tt.slots.length === 0) return { past: [], next: [] };
  const from = timetableStart(cal, tt, today);
  const byKey = new Map(lessons.filter((l) => l.slot?.key).map((l) => [l.slot!.key, l]));
  const past = generateSlots(cal, tt, from, today).map((slot) => ({ slot, lesson: byKey.get(slot.key) }));
  let next: LessonSlot[] = [];
  if (upcoming > 0) {
    const ahead = new Date(fromISO(today).getTime() + 1 * DAY_MS);
    const horizon = new Date(fromISO(today).getTime() + 60 * DAY_MS);
    next = generateSlots(cal, tt, toISO(ahead), toISO(horizon)).slice(0, upcoming);
  }
  return { past, next };
}

export function unrecordedCount(cal: SchoolCalendar | undefined, tt: Timetable | undefined, lessons: LessonRecord[], today: string): number {
  return slotsWithRecords(cal, tt, lessons, today).past.filter((s) => !s.lesson).length;
}

export const WEEKDAYS: { value: 1 | 2 | 3 | 4 | 5; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
];

/** "P3 11:05–12:18" */
export function slotTime(s: { period?: string; start: string; end: string }): string {
  return `${s.period ? `${s.period} ` : ''}${s.start}–${s.end}`;
}
