import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the real site for GitHub Pages.
// `npm run build:preview` makes one self-contained HTML file in demo mode,
// used for the clickable preview.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins:
    mode === 'preview'
      ? [
          react(),
          viteSingleFile(),
          {
            name: 'preview-title',
            transformIndexHtml: (html: string) => html.replace('<title>Lesson Register</title>', '<title>Lesson Register preview</title>'),
          },
        ]
      : [react()],
  define: {
    __PREVIEW__: JSON.stringify(mode === 'preview'),
  },
  build: {
    outDir: mode === 'preview' ? 'dist-preview' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
  },
}));
