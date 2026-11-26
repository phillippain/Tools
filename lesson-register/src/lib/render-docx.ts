import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { TONE_HEX, type Block, type Cell, type DocModel, type Para, type Run } from './doc-model';

const FONT = 'Arial';
const PAGE_W = 16838; // A4 landscape, DXA
const MARGIN = 1008; // 0.7 inch
const CONTENT_W = PAGE_W - MARGIN * 2;
const SIZE = { body: 21, small: 19, tiny: 17 } as const; // half-points

function runs(p: Para) {
  const size = SIZE[p.size ?? 'body'];
  return p.runs.map((r: Run) => {
    const t = new TextRun({
      text: r.text,
      font: FONT,
      size,
      bold: r.bold,
      italics: r.italics,
      strike: r.strike,
      color: r.link ? '1F4FBF' : r.tone ? TONE_HEX[r.tone] : undefined,
      underline: r.link ? {} : undefined,
    });
    return r.link ? new ExternalHyperlink({ link: r.link, children: [t] }) : t;
  });
}

function paragraph(p: Para) {
  return new Paragraph({
    children: runs(p),
    alignment: p.align === 'center' ? AlignmentType.CENTER : p.align === 'right' ? AlignmentType.RIGHT : undefined,
    indent: p.indent ? { left: 240 } : undefined,
    spacing: { before: (p.before ?? 0) * 20, after: (p.after ?? 3) * 20 },
  });
}

/** Relative widths to DXA, summing exactly to the content width. */
function dxa(widths: number[]) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const out = widths.map((w) => Math.floor((w / sum) * CONTENT_W));
  out[out.length - 1] += CONTENT_W - out.reduce((a, b) => a + b, 0);
  return out;
}

function tableCell(c: Cell, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: c.colSpan,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    shading: c.fill ? { type: ShadingType.CLEAR, fill: c.fill, color: 'auto' } : undefined,
    children: c.paras.map(paragraph),
  });
}

function table(widths: number[], header: Cell[] | undefined, rows: Cell[][]) {
  const cols = dxa(widths);
  const row = (cells: Cell[], isHeader = false) => {
    let i = 0;
    const children = cells.map((c) => {
      const span = c.colSpan ?? 1;
      const w = cols.slice(i, i + span).reduce((a, b) => a + b, 0);
      i += span;
      return tableCell(c, w);
    });
    return new TableRow({ tableHeader: isHeader, cantSplit: true, children });
  };
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [...(header ? [row(header, true)] : []), ...rows.map((r) => row(r))],
  });
}

function blockToDocx(b: Block): (Paragraph | Table)[] {
  switch (b.t) {
    case 'title':
      return [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: b.text, font: FONT })] })];
    case 'subtitle':
      return [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: b.text, font: FONT, size: 26, color: '333333' })] })];
    case 'h1':
      return [
        ...(b.newPage ? [new Paragraph({ children: [new PageBreak()] })] : []),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: b.text, font: FONT })] }),
      ];
    case 'h2':
      return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: b.text, font: FONT })] })];
    case 'p':
      return [paragraph(b.para)];
    case 'table':
      return [table(b.widths, b.header, b.rows), new Paragraph({ spacing: { after: 60 }, children: [] })];
  }
}

export function renderDocx(m: DocModel): Document {
  return new Document({
    creator: m.author,
    title: m.title,
    description: 'Produced by Lesson Register',
    styles: {
      default: {
        document: { run: { font: FONT, size: 21 } },
        title: { run: { font: FONT, size: 40, bold: true, color: '16325C' }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
        heading1: { run: { font: FONT, size: 28, bold: true, color: '16325C' }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
        heading2: { run: { font: FONT, size: 23, bold: true, color: '16325C' }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 4 } },
                children: [
                  new TextRun({ text: `${m.footer} · `, font: FONT, size: 16, color: '666666' }),
                  new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '666666' }),
                ],
              }),
            ],
          }),
        },
        children: m.blocks.flatMap(blockToDocx),
      },
    ],
  });
}

export function docxBlob(m: DocModel): Promise<Blob> {
  return Packer.toBlob(renderDocx(m));
}
