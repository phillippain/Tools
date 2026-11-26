import type { ActivityState, Item, LessonRecord, Program, Rating, Unit } from './types';
import { flatItems, plannedPoints, type ItemRef } from './program';

export type ItemStatus = 'not-started' | 'in-progress' | 'finished';

export interface ItemProgress {
  status: ItemStatus;
  dates: string[];
}

function held(lessons: LessonRecord[]): LessonRecord[] {
  return lessons.filter((l) => l.held).sort((a, b) => a.date.localeCompare(b.date));
}

export function itemProgress(program: Program, lessons: LessonRecord[]): Map<string, ItemProgress> {
  const m = new Map<string, ItemProgress>();
  for (const { item } of flatItems(program)) m.set(item.id, { status: 'not-started', dates: [] });
  for (const l of held(lessons)) {
    for (const it of l.items) {
      const p = m.get(it.itemId);
      if (!p) continue;
      if (!p.dates.includes(l.date)) p.dates.push(l.date);
      if (it.finished) p.status = 'finished';
      else if (p.status === 'not-started') p.status = 'in-progress';
    }
  }
  return m;
}

/** The item to teach next: the first one, in program order, not yet finished. */
export function nextItem(program: Program, progress: Map<string, ItemProgress>): ItemRef | undefined {
  return flatItems(program).find((r) => progress.get(r.item.id)?.status !== 'finished');
}

export type ActivityOutcome = ActivityState | 'not-recorded' | 'pending';

export interface ActivitySummary {
  outcome: ActivityOutcome;
  entries: { date: string; state: ActivityState; note?: string }[];
}

/** What happened to each planned activity, across every lesson so far. */
export function activitySummary(
  program: Program,
  lessons: LessonRecord[],
  progress: Map<string, ItemProgress>,
): Map<string, ActivitySummary> {
  const m = new Map<string, ActivitySummary>();
  const ensure = (id: string) => {
    let s = m.get(id);
    if (!s) {
      s = { outcome: 'pending', entries: [] };
      m.set(id, s);
    }
    return s;
  };
  for (const l of held(lessons))
    for (const [id, v] of Object.entries(l.activities)) ensure(id).entries.push({ date: l.date, state: v.state, note: v.note });

  for (const unit of program.units) {
    const unitFinished = unit.items.every((i) => progress.get(i.id)?.status === 'finished');
    for (const a of unit.routines ?? []) settle(ensure(a.id), unitFinished);
    for (const item of unit.items) {
      const finished = progress.get(item.id)?.status === 'finished';
      for (const a of item.activities) settle(ensure(a.id), finished);
    }
  }
  return m;
}

function settle(s: ActivitySummary, finished: boolean) {
  const states = s.entries.map((e) => e.state);
  if (states.includes('adapted')) s.outcome = 'adapted';
  else if (states.includes('done')) s.outcome = 'done';
  else if (states.includes('skipped')) s.outcome = 'skipped';
  else s.outcome = finished ? 'not-recorded' : 'pending';
}

export interface ResourceSummary {
  ratings: { date: string; rating: Rating; note?: string }[];
  overall?: Rating;
}

const TIE_ORDER: Rating[] = ['poor', 'ok', 'good'];

export function resourceSummary(lessons: LessonRecord[]): Map<string, ResourceSummary> {
  const m = new Map<string, ResourceSummary>();
  for (const l of held(lessons)) {
    for (const [id, v] of Object.entries(l.resources)) {
      const s = m.get(id) ?? { ratings: [] };
      s.ratings.push({ date: l.date, rating: v.rating, note: v.note });
      m.set(id, s);
    }
    // Resources added on the day carry their own rating.
    for (const r of l.addedResources)
      if (r.rating) {
        const s = m.get(r.id) ?? { ratings: [] };
        s.ratings.push({ date: l.date, rating: r.rating });
        m.set(r.id, s);
      }
  }
  for (const s of m.values()) {
    const used = s.ratings.filter((r) => r.rating !== 'unused');
    if (used.length === 0) s.overall = 'unused';
    else {
      // Most frequent rating; a tie goes to the more cautious one (poor, then ok, then good).
      const counts = new Map<Rating, number>();
      for (const r of used) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
      let best: Rating = 'good';
      let bestN = 0;
      for (const r of TIE_ORDER) {
        const n = counts.get(r) ?? 0;
        if (n > bestN) {
          best = r;
          bestN = n;
        }
      }
      s.overall = best;
    }
  }
  return m;
}

export interface Coverage {
  points: Map<string, string[]>; // content point -> dates taught
  outcomes: Map<string, string[]>; // outcome -> dates
  planned: string[]; // content points in the program
}

export function coverage(program: Program, lessons: LessonRecord[]): Coverage {
  const points = new Map<string, string[]>();
  const outcomes = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, d: string) => {
    const a = m.get(k) ?? [];
    if (!a.includes(d)) a.push(d);
    m.set(k, a);
  };
  for (const l of held(lessons)) {
    for (const s of l.syllabus) add(points, s, l.date);
    for (const o of l.outcomes) add(outcomes, o, l.date);
  }
  return { points, outcomes, planned: plannedPoints(program) };
}

export function coveragePercent(c: Coverage): number {
  if (c.planned.length === 0) return 0;
  const taught = c.planned.filter((p) => (c.points.get(p)?.length ?? 0) > 0).length;
  return Math.round((taught / c.planned.length) * 100);
}

export interface UnitSummary {
  unit: Unit;
  dates: string[];
  lessons: number;
  finished: number;
  total: number;
  status: ItemStatus;
}

export function unitSummaries(program: Program, lessons: LessonRecord[], progress: Map<string, ItemProgress>): UnitSummary[] {
  return program.units.map((unit) => {
    const ids = new Set(unit.items.map((i) => i.id));
    const dates = new Set<string>();
    let count = 0;
    for (const l of held(lessons))
      if (l.items.some((x) => ids.has(x.itemId))) {
        dates.add(l.date);
        count++;
      }
    const finished = unit.items.filter((i) => progress.get(i.id)?.status === 'finished').length;
    const started = unit.items.some((i) => progress.get(i.id)?.status !== 'not-started');
    const status: ItemStatus = finished === unit.items.length ? 'finished' : started ? 'in-progress' : 'not-started';
    return { unit, dates: [...dates].sort(), lessons: count, finished, total: unit.items.length, status };
  });
}

export function lostLessons(lessons: LessonRecord[]): LessonRecord[] {
  return lessons.filter((l) => !l.held).sort((a, b) => a.date.localeCompare(b.date));
}

/** Default activity states for a newly selected item in the lesson form. */
export function defaultActivityState(item: Item): ActivityState | undefined {
  return item.kind === 'lesson' ? 'done' : undefined;
}

export const STATE_LABEL: Record<ActivityOutcome, string> = {
  done: 'As planned',
  adapted: 'Adapted',
  skipped: 'Not used',
  'not-recorded': 'Not recorded',
  pending: 'Not yet taught',
};

export const STATE_SYMBOL: Record<ActivityOutcome, string> = {
  done: '✓',
  adapted: '~',
  skipped: '✗',
  'not-recorded': '○',
  pending: '·',
};

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Worked well',
  ok: 'Okay',
  poor: 'Didn’t work',
  unused: 'Not used',
};
