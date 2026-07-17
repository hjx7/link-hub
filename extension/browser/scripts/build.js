/**
 * 完整构建脚本
 * 1. TypeScript 类型检查
 * 2. Vite 构建 newtab 页面
 * 3. esbuild 编译 background/content/command 脚本
 * 4. 复制静态文件
 */

import { execSync } from 'child_process';
import { buildSync } from 'esbuild';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const src = resolve(root, 'src');

function removeRecursive(targetPath) {
  if (!existsSync(targetPath)) return;
  for (const entry of readdirSync(targetPath)) {
    const entryPath = resolve(targetPath, entry);
    if (statSync(entryPath).isDirectory()) {
      removeRecursive(entryPath);
    } else {
      unlinkSync(entryPath);
    }
  }
  rmdirSync(targetPath);
}

function copyRecursive(sourcePath, targetPath) {
  if (statSync(sourcePath).isDirectory()) {
    mkdirSync(targetPath, { recursive: true });
    for (const entry of readdirSync(sourcePath)) {
      copyRecursive(resolve(sourcePath, entry), resolve(targetPath, entry));
    }
    return;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}

// 清空 dist
removeRecursive(dist);
mkdirSync(dist, { recursive: true });

// 1. TypeScript 类型检查
console.log('→ Type checking...');
try {
  execSync('npx tsc --noEmit', { cwd: root, stdio: 'pipe' });
  console.log('  ✓ No type errors');
} catch (e) {
  console.error('  ✗ Type errors found:');
  const stdout = e && e.stdout ? e.stdout.toString() : '';
  console.error(stdout || (e && e.message ? e.message : e));
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
copyRecursive(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

// assets/
copyRecursive(resolve(root, 'assets'), resolve(dist, 'assets'));

// command/index.html
copyRecursive(resolve(src, 'command/index.html'), resolve(dist, 'command/index.html'));

console.log('  ✓ Done');
console.log('\n✅ Build complete → dist/');
