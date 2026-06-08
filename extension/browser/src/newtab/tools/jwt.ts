/**
 * JWT 解析工具
 */
// @ts-nocheck

import { escapeHtml } from '../utils';

export function parseJwt(): void {
  const input = document.getElementById('jwtInput').value.trim();
  const resultEl = document.getElementById('jwtResult');

  if (!input) { resultEl.innerHTML = '<div class="jwt-placeholder">粘贴 JWT Token 后自动解析</div>'; return; }

  const parts = input.split('.');
  if (parts.length !== 3) { resultEl.innerHTML = '<div class="jwt-error">无效的 JWT 格式（需要 3 段由 . 分隔）</div>'; return; }

  function decodeBase64Url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));

    let payloadExtra = '';
    for (const field of ['exp', 'iat', 'nbf']) {
      if (payload[field]) {
        const d = new Date(payload[field] * 1000);
        payloadExtra += `<div class="jwt-time-hint">${field}: ${d.toLocaleString('zh-CN')}${field === 'exp' ? (d < new Date() ? ' (已过期)' : ' (有效)') : ''}</div>`;
      }
    }

    resultEl.innerHTML = `
      <div class="jwt-part">
        <div class="jwt-part-header"><span class="jwt-part-label jwt-header-color">HEADER</span><span class="jwt-part-alg">${escapeHtml(header.alg || '')}</span></div>
        <pre class="jwt-part-content">${escapeHtml(JSON.stringify(header, null, 2))}</pre>
      </div>
      <div class="jwt-part">
        <div class="jwt-part-header"><span class="jwt-part-label jwt-payload-color">PAYLOAD</span></div>
        <pre class="jwt-part-content">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
        ${payloadExtra}
      </div>
      <div class="jwt-part">
        <div class="jwt-part-header"><span class="jwt-part-label jwt-signature-color">SIGNATURE</span></div>
        <pre class="jwt-part-content jwt-signature">${escapeHtml(parts[2])}</pre>
      </div>
    `;
  } catch (e) {
    resultEl.innerHTML = `<div class="jwt-error">解析失败: ${escapeHtml(e.message)}</div>`;
  }
}

export function initJwtEvents(): void {
  document.getElementById('jwtInput')?.addEventListener('input', () => parseJwt());
}
