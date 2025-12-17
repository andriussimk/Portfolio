import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue(), cloudflareStaticFiles()],
  server: {
    open: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Treat each static HTML file as an entry so Pages can serve them directly
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        galleries: resolve(__dirname, 'galleries.html'),
        collection: resolve(__dirname, 'collection.html'),
        contacts: resolve(__dirname, 'contacts.html'),
        adminPanel: resolve(__dirname, 'adminPanel.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

// Copy Cloudflare Pages routing files into dist so they take effect on deploy.
// (Pages only reads _redirects/_headers from the published output directory.)
function cloudflareStaticFiles() {
  return {
    name: 'cloudflare-static-files',
    apply: 'build' as const,
    generateBundle(this: any) {
      this.emitFile({
          // Cloudflare Pages appears to canonicalize *.html to extensionless paths (308).
          // If we also redirect the extensionless path to .html, that creates a loop.
          // Solution: serve /adminPanel as the canonical URL and rewrite it to /adminPanel.html.
          type: 'asset',
          fileName: '_redirects',
          source: [
            '/adminPanel /adminPanel.html 200',
            // Optional: if someone explicitly visits the .html URL, let Pages canonicalize it.
            // (No rule needed here; Cloudflare handles it.)
            '',
          ].join('\n'),
      });
    },
  };
}