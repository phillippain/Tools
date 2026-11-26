import type { DocModel } from './doc-model';

export type Format = 'docx' | 'pdf';

/** Render a document model to a file. Both renderers load only when needed. */
export async function renderModel(m: DocModel, format: Format): Promise<Blob> {
  if (format === 'pdf') {
    const { pdfBlob } = await import('./render-pdf');
    return pdfBlob(m);
  }
  const { docxBlob } = await import('./render-docx');
  return docxBlob(m);
}
