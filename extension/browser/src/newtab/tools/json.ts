/**
 * JSON 格式化/压缩工具
 */
// @ts-nocheck

import { escapeHtml } from '../utils';

let jsonMode = 'format';
let currentJsonResult = '';
let jsonFormatTimer: ReturnType<typeof setTimeout> | null = null;

export function setJsonMode(mode: string): void {
  jsonMode = mode;
  document.querySelectorAll('.json-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const outputEl = document.getElementById('toolOutput');
  const outputWrapper = outputEl?.closest('.json-output-wrapper');
  if (outputEl) outputEl.classList.toggle('compress-mode', mode === 'compress');
  if (outputWrapper) outputWrapper.classList.toggle('compress-mode', mode === 'compress');

  const input = document.getElementById('toolInput').value.trim();
  if (input) executeJsonTool();
}

function highlightJson(json: string): string {
  if (typeof json !== 'string') json = JSON.stringify(json);
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
        match = match.slice(0, -1) + '<span class="json-bracket">:</span>';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

export function executeJsonTool(): void {
  if (jsonFormatTimer) clearTimeout(jsonFormatTimer);
  jsonFormatTimer = setTimeout(() => {
    const input = document.getElementById('toolInput').value.trim();
    const outputEl = document.getElementById('toolOutput');
    const errorEl = document.getElementById('toolError');
    if (!input) { errorEl.style.display = 'none'; outputEl.innerHTML = ''; return; }
    try {
      const parsed = JSON.parse(input);
      let result;
      if (jsonMode === 'format') {
        result = JSON.stringify(parsed, null, 2);
        currentJsonResult = result;
        outputEl.innerHTML = `<pre class="json-result">${highlightJson(result)}</pre>`;
      } else {
        result = JSON.stringify(parsed);
        currentJsonResult = result;
        outputEl.innerHTML = `<pre class="json-result">${escapeHtml(result)}</pre>`;
      }
      errorEl.style.display = 'none';
    } catch (err) {
      errorEl.textContent = 'JSON 格式错误: ' + err.message;
      errorEl.style.display = 'block';
      outputEl.innerHTML = '';
      currentJsonResult = '';
    }
  }, 150);
}

export function copyJsonResult(): string {
  return currentJsonResult;
}

export function getJsonMode(): string {
  return jsonMode;
}

export function initJsonEvents(): void {
  document.getElementById('toolInput')?.addEventListener('input', executeJsonTool);
}
