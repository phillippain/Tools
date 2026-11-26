import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { seedDemo } from '../lib/store-local';
import { buildRecordModel } from '../lib/record-model';
import { pdfBlob } from '../lib/render-pdf';
import { matrixDoc } from '../lib/matrix-model';
import { courseMatrix } from '../lib/matrix';

it('renders the record and a course matrix as PDF', async () => {
  const db = seedDemo(new Date(2026, 10, 26));
  const lessons = db.lessons.filter((l) => l.classId === 'demo-12eco6');
  const model = buildRecordModel({
    program: db.programs[0],
    cls: db.classes[0],
    teacherName: 'Phillip (demo)',
    faculty: db.faculty,
    lessons,
    students: db.students,
    reviews: db.reviews,
  });
  const blob = await pdfBlob(model);
  const buf = Buffer.from(await blob.arrayBuffer());
  expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  if (process.env.WRITE_PDF) writeFileSync(process.env.WRITE_PDF, buf);
  const m = courseMatrix(db.programs[0], db.classes.map((cls) => ({ cls, lessons: db.lessons.filter((l) => l.classId === cls.id) })));
  const b2 = await pdfBlob(matrixDoc(m, 'Head Teacher'));
  const buf2 = Buffer.from(await b2.arrayBuffer());
  expect(buf2.length).toBeGreaterThan(2000);
  if (process.env.WRITE_PDF) writeFileSync(process.env.WRITE_PDF.replace('.pdf', '-course.pdf'), buf2);
}, 60000);
