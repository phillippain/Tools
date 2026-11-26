import type { ClassGroup, Item, LessonRecord, Program, StudentEntry, UnitReview } from '../lib/types';
import type { Store } from '../lib/store';
import { newId, todayISO } from '../lib/util';
import { useApp, useAsync } from './context';

export interface ClassBundle {
  cls: ClassGroup;
  program: Program;
  lessons: LessonRecord[];
  students: StudentEntry[];
  reviews: UnitReview[];
}

export async function loadClassBundle(store: Store, classId: string): Promise<ClassBundle> {
  const cls = await store.getClass(classId);
  const [program, lessons, students, reviews] = await Promise.all([
    store.getProgram(cls.programId),
    store.listLessons(classId),
    store.listStudents(classId),
    store.listReviews(classId),
  ]);
  return { cls, program, lessons, students, reviews };
}

export function useClassBundle(classId: string) {
  const { store } = useApp();
  return useAsync(() => loadClassBundle(store, classId), [store, classId]);
}

export function blankLesson(classId: string, date = todayISO()): LessonRecord {
  return {
    id: newId(),
    classId,
    date,
    held: true,
    items: [],
    activities: {},
    added: [],
    resources: {},
    addedResources: [],
    syllabus: [],
    outcomes: [],
    adjustments: { asPlanned: true, exceptions: [] },
  };
}

/** A one-tap record: the item taught exactly as planned. */
export function asPlannedLesson(classId: string, item: Item): LessonRecord {
  const l = blankLesson(classId);
  l.items = [{ itemId: item.id, finished: true }];
  for (const a of item.activities) l.activities[a.id] = { state: 'done' };
  l.syllabus = [...item.syllabus];
  l.outcomes = [...item.outcomes];
  return l;
}
