import type { Activity, Item, Program, Resource, Unit } from './types';
import { ecoT34Program } from '../data/programs/eco-t34-2027';

/** Programs that ship with the site and can be added to a faculty in one tap. */
export const PROGRAM_LIBRARY: Program[] = [ecoT34Program];

export interface ItemRef {
  unit: Unit;
  item: Item;
  index: number; // position in program order
}

export function flatItems(p: Program): ItemRef[] {
  const out: ItemRef[] = [];
  let i = 0;
  for (const unit of p.units) for (const item of unit.items) out.push({ unit, item, index: i++ });
  return out;
}

export function findItem(p: Program, itemId: string): ItemRef | undefined {
  return flatItems(p).find((r) => r.item.id === itemId);
}

export function findUnit(p: Program, unitId: string): Unit | undefined {
  return p.units.find((u) => u.id === unitId);
}

/** Every activity in the program (item activities and unit routines), by id. */
export function activityIndex(p: Program): Map<string, { activity: Activity; unit: Unit; item?: Item; routine: boolean }> {
  const m = new Map<string, { activity: Activity; unit: Unit; item?: Item; routine: boolean }>();
  for (const unit of p.units) {
    for (const a of unit.routines ?? []) m.set(a.id, { activity: a, unit, routine: true });
    for (const item of unit.items) for (const a of item.activities) m.set(a.id, { activity: a, unit, item, routine: false });
  }
  return m;
}

/** Every resource named anywhere in the program, by id. */
export function resourceIndex(p: Program): Map<string, Resource> {
  const m = new Map<string, Resource>();
  for (const r of p.resources ?? []) m.set(r.id, r);
  for (const unit of p.units) {
    for (const r of unit.resources ?? []) if (!m.has(r.id)) m.set(r.id, r);
    for (const item of unit.items) for (const r of item.resources) if (!m.has(r.id)) m.set(r.id, r);
  }
  return m;
}

/** Content points the program plans to teach, in program order. */
export function plannedPoints(p: Program): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { item } of flatItems(p))
    for (const s of item.syllabus)
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
  return out;
}

export function itemLabel(ref: { unit: Unit; item: Item }): string {
  const code = ref.item.code ? `${ref.item.code}: ` : '';
  return `${ref.unit.code} · ${code}${ref.item.title}`;
}

/** Light structural check for an imported program file. Returns a list of problems. */
export function validateProgram(p: unknown): string[] {
  const errs: string[] = [];
  const prog = p as Program;
  if (!prog || typeof prog !== 'object') return ['The file is not a program.'];
  if (!prog.title) errs.push('Missing title.');
  if (!prog.syllabusId) errs.push('Missing syllabusId.');
  if (!Array.isArray(prog.units) || prog.units.length === 0) errs.push('No units.');
  const ids = new Set<string>();
  for (const u of prog.units ?? []) {
    if (!Array.isArray(u.items)) errs.push(`Unit ${u.code ?? u.id} has no items.`);
    for (const it of u.items ?? []) {
      if (ids.has(it.id)) errs.push(`Duplicate item id ${it.id}.`);
      ids.add(it.id);
      for (const a of it.activities ?? []) {
        if (ids.has(a.id)) errs.push(`Duplicate activity id ${a.id}.`);
        ids.add(a.id);
      }
    }
  }
  return errs;
}
