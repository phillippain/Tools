// A small document model shared by the Word and PDF exports, so both formats
// always carry the same content in the same layout.

export type Tone = 'done' | 'adapted' | 'skipped' | 'added' | 'muted' | 'brand' | 'ink' | 'soft' | 'white';

export interface Run {
  text: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  tone?: Tone;
  link?: string;
}

export type Size = 'body' | 'small' | 'tiny';

export interface Para {
  runs: Run[];
  size?: Size;
  indent?: boolean;
  before?: number; // extra space above, in points
  after?: number; // space below, in points
  align?: 'left' | 'center' | 'right';
}

export interface Cell {
  paras: Para[];
  fill?: string; // hex without #
  align?: 'left' | 'center';
  colSpan?: number;
}

export type Block =
  | { t: 'title'; text: string }
  | { t: 'subtitle'; text: string }
  | { t: 'h1'; text: string; newPage?: boolean }
  | { t: 'h2'; text: string }
  | { t: 'p'; para: Para }
  | { t: 'table'; widths: number[]; header?: Cell[]; rows: Cell[][] };

export interface DocModel {
  title: string;
  author: string;
  footer: string;
  blocks: Block[];
}

export const TONE_HEX: Record<Tone, string> = {
  done: '1B6B32',
  adapted: '9A5B00',
  skipped: '8A1C1C',
  added: '4B2F96',
  muted: '6B6B6B',
  brand: '16325C',
  ink: '15233F',
  soft: '444444',
  white: 'FFFFFF',
};

export const HEADER_FILL = 'E3EAF4';

export function run(text: string, o: Omit<Run, 'text'> = {}): Run {
  return { text, ...o };
}

export function para(content: Run[] | string, o: Omit<Para, 'runs'> = {}): Para {
  return { runs: typeof content === 'string' ? [run(content)] : content, ...o };
}

/** A table cell: plain text becomes one small paragraph. */
export function cell(content: Para[] | Para | string, o: Omit<Cell, 'paras'> = {}): Cell {
  const paras = typeof content === 'string' ? [para(content, { size: 'small' })] : Array.isArray(content) ? content : [content];
  return { paras: paras.length ? paras : [para('', { size: 'small' })], ...o };
}

export function headerCells(labels: string[]): Cell[] {
  return labels.map((l) => cell(para([run(l, { bold: true })], { size: 'small' }), { fill: HEADER_FILL }));
}

/** Symbols that need the symbol font in the PDF. */
export const SYMBOL_RE = /[←-⇿─-➿]/;
