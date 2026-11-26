import eco09 from '../data/syllabuses/eco09.json';
import type { ContentGroup, ContentPoint, Outcome, Syllabus, SyllabusArea, SyllabusCourse } from './types';

// Add a syllabus to the library by dropping its JSON file in
// src/data/syllabuses and listing it here.
export const SYLLABUSES: Syllabus[] = [eco09 as Syllabus];

export interface PointRef {
  syllabus: Syllabus;
  course: SyllabusCourse;
  area: SyllabusArea;
  group: ContentGroup;
  point: ContentPoint;
}

const pointIndex = new Map<string, PointRef>();
const outcomeIndex = new Map<string, { outcome: Outcome; course: SyllabusCourse; syllabus: Syllabus }>();

for (const syllabus of SYLLABUSES) {
  for (const course of syllabus.courses) {
    for (const outcome of course.outcomes) outcomeIndex.set(outcome.id, { outcome, course, syllabus });
    for (const area of course.areas)
      for (const group of area.groups)
        for (const point of group.points) pointIndex.set(point.id, { syllabus, course, area, group, point });
  }
}

export function getSyllabus(id: string): Syllabus | undefined {
  return SYLLABUSES.find((s) => s.id === id);
}

export function getCourse(syllabusId: string, courseId: string): SyllabusCourse | undefined {
  return getSyllabus(syllabusId)?.courses.find((c) => c.id === courseId);
}

export function point(id: string): PointRef | undefined {
  return pointIndex.get(id);
}

export function outcome(id: string): Outcome | undefined {
  return outcomeIndex.get(id)?.outcome;
}

/** "Topic 3 · Economic growth: Sources of growth…" */
export function pointLabel(id: string, withArea = false): string {
  const ref = pointIndex.get(id);
  if (!ref) return id;
  return withArea ? `${ref.area.code} · ${ref.group.title}: ${ref.point.label}` : ref.point.label;
}

export function outcomeLabel(id: string): string {
  const o = outcomeIndex.get(id)?.outcome;
  return o ? `${o.code} ${o.label}` : id;
}

export function outcomeCode(id: string): string {
  return outcomeIndex.get(id)?.outcome.code ?? id;
}
