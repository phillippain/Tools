import { SYMBOL_RE, TONE_HEX, type Block, type Cell, type DocModel, type Para, type Run } from './doc-model';

const PAGE_W = 841.89; // A4 landscape, points
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SIZE = { body: 10.5, small: 9.5, tiny: 8.5 } as const;

type Inline = Record<string, unknown>;

/** Split text so symbol characters use the symbol font. */
function inlines(r: Run): Inline[] {
  const base: Inline = {
    bold: r.bold || undefined,
    italics: r.italics || undefined,
    decoration: r.strike ? 'lineThrough' : r.link ? 'underline' : undefined,
    color: r.link ? '#1F4FBF' : r.tone ? `#${TONE_HEX[r.tone]}` : undefined,
    link: r.link,
  };
  const out: Inline[] = [];
  let buf = '';
  let symMode = false;
  const flush = () => {
    if (!buf) return;
    out.push({ ...base, text: buf, ...(symMode ? { font: 'Sym' } : {}) });
    buf = '';
  };
  for (const ch of r.text) {
    const isSym = SYMBOL_RE.test(ch);
    if (isSym !== symMode) {
      flush();
      symMode = isSym;
    }
    buf += ch;
  }
  flush();
  return out;
}

function paragraph(p: Para): Inline {
  return {
    text: p.runs.flatMap(inlines),
    fontSize: SIZE[p.size ?? 'body'],
    alignment: p.align,
    margin: [p.indent ? 12 : 0, p.before ?? 0, 0, p.after ?? 2],
  };
}

const PAD = 4;
const LINE = 0.5;

/** Relative widths to points. pdfmake widths exclude cell padding and borders, so take those off first. */
function widthsPt(widths: number[]) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const avail = CONTENT_W - widths.length * PAD * 2 - (widths.length + 1) * LINE - 1;
  return widths.map((w) => (w / sum) * avail);
}

function tableCell(c: Cell): Inline[] {
  const main: Inline = {
    stack: c.paras.map(paragraph),
    fillColor: c.fill ? `#${c.fill}` : undefined,
    colSpan: c.colSpan,
    alignment: c.align,
  };
  // pdfmake expects a placeholder for each extra column a cell spans.
  return [main, ...Array.from({ length: (c.colSpan ?? 1) - 1 }, () => ({}))];
}

function block(b: Block): Inline[] {
  switch (b.t) {
    case 'title':
      return [{ text: b.text, style: 'title' }];
    case 'subtitle':
      return [{ text: b.text, style: 'subtitle' }];
    case 'h1':
      return [{ text: b.text, style: 'h1', headlineLevel: 1, pageBreak: b.newPage ? 'before' : undefined }];
    case 'h2':
      return [{ text: b.text, style: 'h2', headlineLevel: 2 }];
    case 'p':
      return [paragraph(b.para)];
    case 'table': {
      const body = [...(b.header ? [b.header.flatMap(tableCell)] : []), ...b.rows.map((r) => r.flatMap(tableCell))];
      return [
        {
          table: { headerRows: b.header ? 1 : 0, keepWithHeaderRows: b.header ? 1 : 0, widths: widthsPt(b.widths), body, dontBreakRows: true },
          layout: {
            hLineWidth: () => LINE,
            vLineWidth: () => LINE,
            hLineColor: () => '#C9D1DE',
            vLineColor: () => '#C9D1DE',
            paddingLeft: () => PAD,
            paddingRight: () => PAD,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
          margin: [0, 2, 0, 8],
        },
      ];
    }
  }
}

export async function pdfBlob(m: DocModel): Promise<Blob> {
  const [{ default: pdfMake }, { PDF_FONTS, PDF_VFS }] = await Promise.all([import('pdfmake/build/pdfmake'), import('./pdf-fonts')]);
  pdfMake.addVirtualFileSystem(PDF_VFS);
  pdfMake.addFonts(PDF_FONTS);
  const doc = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN + 6],
    info: { title: m.title, author: m.author, creator: 'Lesson Register' },
    defaultStyle: { font: 'Text', fontSize: SIZE.body, color: '#15233F', lineHeight: 1.15 },
    styles: {
      title: { fontSize: 20, bold: true, color: '#16325C', margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 13, color: '#333333', margin: [0, 0, 0, 10] },
      h1: { fontSize: 14, bold: true, color: '#16325C', margin: [0, 14, 0, 6] },
      h2: { fontSize: 11.5, bold: true, color: '#16325C', margin: [0, 8, 0, 4] },
    },
    footer: (page: number, pages: number) => ({
      text: `${m.footer} · Page ${page} of ${pages}`,
      alignment: 'right',
      fontSize: 8,
      color: '#666666',
      margin: [MARGIN, 12, MARGIN, 0],
    }),
    content: m.blocks.flatMap(block),
    // Keep headings off the bottom of a page, away from the content they introduce.
    pageBreakBefore: (node: { headlineLevel?: number; startPosition?: { verticalRatio?: number } }) =>
      !!node.headlineLevel && (node.startPosition?.verticalRatio ?? 0) > (node.headlineLevel === 1 ? 0.7 : 0.82),
  };
  return pdfMake.createPdf(doc).getBlob();
}
