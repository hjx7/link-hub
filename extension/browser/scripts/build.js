/**
 * 完整构建脚本
 * 1. TypeScript 类型检查
 * 2. Vite 构建 newtab 页面
 * 3. esbuild 编译 background/content/command 脚本
 * 4. 复制静态文件
 */

import { execSync } from 'child_process';
import { buildSync } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const src = resolve(root, 'src');

// 清空 dist
if (existsSync(dist)) rmSync(dist, { recursive: true });
mkdirSync(dist, { recursive: true });

// 1. TypeScript 类型检查
console.log('→ Type checking...');
try {
  execSync('npx tsc --noEmit', { cwd: root, stdio: 'pipe' });
  console.log('  ✓ No type errors');
} catch (e) {
  console.error('  ✗ Type errors found:');
  console.error(e.stdout?.toString() || e.message);
  process.exit(1);
}

// 2. Vite 构建 newtab
console.log('→ Building newtab...');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

// 3. esbuild 编译独立脚本（IIFE 格式，不用 module）
console.log('→ Building scripts...');

const scripts = [
  { entry: 'src/background.ts', out: 'dist/background.js', bundle: false },
  { entry: 'src/content.ts', out: 'dist/content.js', bundle: false },
  { entry: 'src/command.ts', out: 'dist/command/command.js', bundle: true },
];

for (const { entry, out, bundle } of scripts) {
  const outPath = resolve(root, out);
  mkdirSync(dirname(outPath), { recursive: true });
  buildSync({
    entryPoints: [resolve(root, entry)],
    outfile: outPath,
    bundle,
    format: 'iife',
    target: 'es2020',
    minify: false,
  });
}
console.log('  ✓ background.js, content.js, command.js');

// 4. 复制静态文件
console.log('→ Copying static files...');

// manifest.json
cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

// assets/
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });

// command/index.html
cpSync(resolve(src, 'command/index.html'), resolve(dist, 'command/index.html'));

// newtab/js/data.js（供 command iframe 引用）
mkdirSync(resolve(dist, 'newtab/js'), { recursive: true });
const dataTsContent = readFileSync(resolve(src, 'newtab/data.ts'), 'utf-8');
const match = dataTsContent.match(/export const devSiteCategories[^=]*=\s*(\[[\s\S]*?\n\];)/);
if (match) {
  writeFileSync(resolve(dist, 'newtab/js/data.js'), `window.LinkHubData = { devSiteCategories: ${match[1]} };\n`, 'utf-8');
}

console.log('  ✓ Done');
console.log('\n✅ Build complete → dist/');
