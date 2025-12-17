import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
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