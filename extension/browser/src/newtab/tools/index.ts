/**
 * 工具模块入口
 */
// @ts-nocheck

import { showCopyToast } from './shared';
import { setJsonMode, executeJsonTool, copyJsonResult, getJsonMode, initJsonEvents } from './json';
import { startTimestampTimer, stopTimestampTimer, copyCurrentTimestamp, initTimestampEvents } from './timestamp';
import { parseCron, initCronEvents } from './cron';
import { updateRegexHighlight, testRegex, initRegexEvents } from './regex';
import { urlEncode, urlDecode, urlSwap, urlClear } from './url';
import { base64Encode, base64Decode, base64Swap, base64Clear } from './base64';
import { parseJwt, initJwtEvents } from './jwt';
import { computeAllHashes, copyHash, initHashEvents } from './hash';
import { diffCompare, diffClear, initDiffEvents } from './diff';

let currentTool = 'json';

// 切换工具 Tab
export function selectTool(tool: string): void {
  currentTool = tool;

  document.querySelectorAll('.tools-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tool === tool);
  });

  // 停止时间戳计时器
  stopTimestampTimer();

  // 隐藏所有面板
  const panels = ['jsonToolPanel', 'generalToolPanel', 'timestampToolPanel', 'cronToolPanel',
    'regexToolPanel', 'urlToolPanel', 'base64ToolPanel', 'jwtToolPanel', 'hashToolPanel', 'diffToolPanel'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const errorEl = document.getElementById('toolError');
  if (errorEl) errorEl.style.display = 'none';

  switch (tool) {
    case 'json':
      document.getElementById('jsonToolPanel').style.display = 'flex';
      document.getElementById('toolInput').value = '';
      document.getElementById('toolOutput').innerHTML = '';
      setJsonMode('format');
      break;
    case 'timestamp':
      document.getElementById('timestampToolPanel').style.display = 'flex';
      startTimestampTimer();
      break;
    case 'cron':
      document.getElementById('cronToolPanel').style.display = 'flex';
      break;
    case 'regex':
      document.getElementById('regexToolPanel').style.display = 'flex';
      break;
    case 'url':
      document.getElementById('urlToolPanel').style.display = 'flex';
      break;
    case 'base64':
      document.getElementById('base64ToolPanel').style.display = 'flex';
      break;
    case 'jwt':
      document.getElementById('jwtToolPanel').style.display = 'flex';
      break;
    case 'hash':
      document.getElementById('hashToolPanel').style.display = 'flex';
      break;
    case 'diff':
      document.getElementById('diffToolPanel').style.display = 'flex';
      break;
  }
}

// 复制结果
export function copyToolResult(): void {
  let result = copyJsonResult();
  if (currentTool === 'json' && result) {
    try {
      const parsed = JSON.parse(result);
      result = getJsonMode() === 'format' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
    } catch { /* keep as-is */ }
  } else {
    result = document.getElementById('toolOutputGeneral')?.textContent || '';
  }
  if (result) navigator.clipboard.writeText(result).then(() => showCopyToast());
}

// 清空
export function clearTool(): void {
  if (currentTool === 'json') {
    document.getElementById('toolInput').value = '';
    document.getElementById('toolOutput').innerHTML = '';
  } else {
    document.getElementById('toolInputGeneral').value = '';
    document.getElementById('toolOutputGeneral').innerHTML = '';
  }
  const errorEl = document.getElementById('toolError');
  if (errorEl) errorEl.style.display = 'none';
}

// 通用执行
export function executeTool(): void {
  // 预留给 generalToolPanel 中的通用工具
}

// 初始化所有子工具事件
export function initTools(): void {
  initJsonEvents();
  initTimestampEvents();
  initCronEvents();
  initRegexEvents();
  initJwtEvents();
  initHashEvents();
  initDiffEvents();
  selectTool('json');
}

// 重新导出子工具的公共函数
export {
  setJsonMode,
  copyCurrentTimestamp,
  urlEncode, urlDecode, urlSwap, urlClear,
  base64Encode, base64Decode, base64Swap, base64Clear,
  copyHash
};
