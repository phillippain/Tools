// Fonts embedded in the PDF export, subset to the characters the app uses.
// Roboto (SIL Open Font License 1.1) for text; DejaVu Sans symbols for ✓ ✗ ○.
// Licences: src/fonts/LICENSES.txt
import regular from '../fonts/Roboto-Regular.ttf?inline';
import medium from '../fonts/Roboto-Medium.ttf?inline';
import italic from '../fonts/Roboto-Italic.ttf?inline';
import mediumItalic from '../fonts/Roboto-MediumItalic.ttf?inline';
import sym from '../fonts/DejaVuSans-sym.ttf?inline';
import symBold from '../fonts/DejaVuSans-Bold-sym.ttf?inline';

const b64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

export const PDF_VFS: Record<string, string> = {
  'LR-Roboto-Regular.ttf': b64(regular),
  'LR-Roboto-Medium.ttf': b64(medium),
  'LR-Roboto-Italic.ttf': b64(italic),
  'LR-Roboto-MediumItalic.ttf': b64(mediumItalic),
  'LR-Sym.ttf': b64(sym),
  'LR-Sym-Bold.ttf': b64(symBold),
};

export const PDF_FONTS = {
  Text: {
    normal: 'LR-Roboto-Regular.ttf',
    bold: 'LR-Roboto-Medium.ttf',
    italics: 'LR-Roboto-Italic.ttf',
    bolditalics: 'LR-Roboto-MediumItalic.ttf',
  },
  Sym: {
    normal: 'LR-Sym.ttf',
    bold: 'LR-Sym-Bold.ttf',
    italics: 'LR-Sym.ttf',
    bolditalics: 'LR-Sym-Bold.ttf',
  },
};
