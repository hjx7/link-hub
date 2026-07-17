import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/newtab',
  base: './',
  publicDir: 'public',
  build: {
    outDir: resolve(__dirname, 'dist/newtab'),
    emptyOutDir: false, // 不清空 dist，因为其他脚本也输出到 dist
    rollupOptions: {
      input: resolve(__dirname, 'src/newtab/index.html'),
      output: {
        entryFileNames: 'js/main.js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'styles.css';
          return 'assets/[name][extname]';
        }
      }
    },
    minify: false,
    sourcemap: false
  }
});
