/**
 * MD5/SHA 哈希工具
 */
// @ts-nocheck

import { debounce } from '../utils';
import { showCopyToast } from './shared';
import { md5 } from './md5';

export async function computeAllHashes(): Promise<void> {
  const input = document.getElementById('hashInput').value;
  const outputEl = document.getElementById('hashOutput');
  if (!input) { outputEl.innerHTML = ''; return; }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const md5Hash = md5(input);
    const [sha1Buf, sha256Buf, sha512Buf] = await Promise.all([
      crypto.subtle.digest('SHA-1', data),
      crypto.subtle.digest('SHA-256', data),
      crypto.subtle.digest('SHA-512', data)
    ]);
    const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

    outputEl.innerHTML = [
      { label: 'MD5', value: md5Hash },
      { label: 'SHA-1', value: toHex(sha1Buf) },
      { label: 'SHA-256', value: toHex(sha256Buf) },
      { label: 'SHA-512', value: toHex(sha512Buf) },
    ].map(h => `
      <div class="hash-result-item">
        <span class="hash-result-label">${h.label}</span>
        <code class="hash-result-value">${h.value}</code>
        <button class="btn btn-sm btn-secondary hash-copy-btn" data-action="copy-hash" data-hash="${h.value}">复制</button>
      </div>
    `).join('');
  } catch (e) {
    outputEl.innerHTML = `<div class="jwt-error">计算失败: ${e.message}</div>`;
  }
}

export function copyHash(hash: string): void {
  navigator.clipboard.writeText(hash).then(() => showCopyToast());
}

export function initHashEvents(): void {
  const hashInput = document.getElementById('hashInput');
  if (hashInput) {
    hashInput.addEventListener('input', debounce(() => computeAllHashes(), 300));
  }
}
