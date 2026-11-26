import { cell, headerCells, para, run, type Block, type Cell, type DocModel } from './doc-model';
import { level, type Matrix } from './matrix';
import { longDate, todayISO } from './util';

const LEVEL_FILL = ['', 'DFF0E3', 'B5DCC0', '6FB784'];

/** The matrix as a table plus a one-line key, ready to drop into any document. */
export function matrixBlocks(m: Matrix): Block[] {
  const n = m.columns.length;
  const base = n > 8 ? 5.5 : 7;
  // Widen a column just enough that its longest word ("Revision", a class name) never breaks mid-word.
  const fit = (label: string) => Math.max(base, ...label.split(/\s+/).map((w) => w.length * 0.9));
  const widths = [34, ...m.columns.map((c) => fit(c.label)), 8];
  const span = n + 2;
  const rows: Cell[][] = [];
  for (const r of m.rows) {
    if (r.kind === 'section') {
      rows.push([cell(para([run(r.label, { bold: true, tone: 'white' })], { size: 'small' }), { fill: '15233F', colSpan: span })]);
      continue;
    }
    if (r.kind === 'group') {
      rows.push([cell(para([run(r.label, { bold: true })], { size: 'tiny' }), { fill: 'E9EDF3', colSpan: span })]);
      continue;
    }
    const label = para([...(r.code ? [run(`${r.code} `, { bold: true })] : []), run(r.label)], { size: 'tiny' });
    const cells: Cell[] = [cell(label)];
    for (const c of r.cells) {
      const lv = level(c.count);
      if (c.count > 0)
        cells.push(cell(para([run(String(c.count), { bold: true, tone: lv === 3 ? 'white' : lv === 2 ? 'ink' : 'done' })], { size: 'tiny', align: 'center' }), { fill: LEVEL_FILL[lv], align: 'center' }));
      else if (c.planned) cells.push(cell(para([run('○', { tone: 'muted' })], { size: 'tiny', align: 'center' }), { align: 'center' }));
      else cells.push(cell(para('', { size: 'tiny' })));
    }
    cells.push(
      cell(
        para([run(r.total > 0 ? String(r.total) : r.planned ? '—' : '', { bold: true, tone: r.total === 0 && r.planned ? 'skipped' : 'ink' })], {
          size: 'tiny',
          align: 'center',
        }),
        { fill: 'F7F8FB', align: 'center' },
      ),
    );
    rows.push(cells);
  }
  if (m.footer) {
    rows.push([
      cell(para([run(m.footer.label, { bold: true })], { size: 'tiny' }), { fill: 'F7F8FB' }),
      ...m.footer.values.map((v) => cell(para([run(v, { bold: true })], { size: 'tiny', align: 'center' }), { fill: 'F7F8FB', align: 'center' })),
      cell(para([run(m.footer.total, { bold: true })], { size: 'tiny', align: 'center' }), { fill: 'F7F8FB', align: 'center' }),
    ]);
  }
  return [
    { t: 'table', widths, header: headerCells(['Outcome or content', ...m.columns.map((c) => c.label), 'Total']), rows },
    {
      t: 'p',
      para: para(
        [
          run('Key: ', { bold: true }),
          run('numbers are lessons that covered the outcome or content in that column; '),
          run('○', { tone: 'muted' }),
          run(' planned there but not yet taught; '),
          run('—', { tone: 'skipped', bold: true }),
          run(' planned in the program but not taught anywhere yet. Content labels are short forms for tracking, not the syllabus wording.'),
        ],
        { size: 'small', before: 4 },
      ),
    },
  ];
}

/** A stand-alone matrix document. */
export function matrixDoc(m: Matrix, author: string, extra?: string): DocModel {
  return {
    title: m.title,
    author,
    footer: m.title,
    blocks: [
      { t: 'title', text: m.title },
      { t: 'subtitle', text: `${m.subtitle}${extra ? ` · ${extra}` : ''} · produced ${longDate(todayISO())}` },
      ...matrixBlocks(m),
    ],
  };
}
