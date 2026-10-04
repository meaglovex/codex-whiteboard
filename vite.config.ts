import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loopbackDevBoundary, whiteboardDevProxy } from './scripts/dev-proxy.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), loopbackDevBoundary(), {
    name:'whiteboard-ui-module-report',
    generateBundle(){mkdirSync('.test-data',{recursive:true});writeFileSync('.test-data/ui-inputs.json',JSON.stringify([...this.getModuleIds()].map(id=>path.isAbsolute(id)?path.relative(process.cwd(),id):id).sort(),null,2));},
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host:'127.0.0.1',port:Number(process.env.WHITEBOARD_DEV_PORT||5199),strictPort:true,proxy: { '/api': whiteboardDevProxy(`http://127.0.0.1:${Number(process.env.WHITEBOARD_PORT||5220)}`) } },
  build: { assetsInlineLimit: 10000000 },
});
