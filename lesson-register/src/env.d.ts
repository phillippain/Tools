/// <reference types="vite/client" />
declare const __PREVIEW__: boolean;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

declare module 'pdfmake/build/pdfmake' {
  interface PdfMakeOutput {
    getBlob(): Promise<Blob>;
    getBuffer(): Promise<Uint8Array>;
  }
  interface PdfMakeStatic {
    addVirtualFileSystem(vfs: Record<string, string>): void;
    addFonts(fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>): void;
    createPdf(doc: unknown, options?: Record<string, unknown>): PdfMakeOutput;
  }
  const pdfMake: PdfMakeStatic;
  export default pdfMake;
}
