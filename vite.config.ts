import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: { proxy: { '/api': 'http://127.0.0.1:5210' } },
  build: { assetsInlineLimit: 10000000 },
});
