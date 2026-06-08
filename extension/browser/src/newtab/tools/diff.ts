/**
 * Diff 文本对比工具
 */
// @ts-nocheck

import { escapeHtml, debounce } from '../utils';

export function diffCompare(): void {
  const left = document.getElementById('diffLeft').value;
  const right = document.getElementById('diffRight').value;
  const statsEl = document.getElementById('diffOutput');
  const hlLeft = document.getElementById('diffHighlightLeft');
  const hlRight = document.getElementById('diffHighlightRight');

  if (!left && !right) { hlLeft.innerHTML = ''; hlRight.innerHTML = ''; statsEl.innerHTML = ''; return; }
  if (!left || !right) {
    hlLeft.innerHTML = left.split('\n').map(l => `<div class="diff-hl-line">${escapeHtml(l) || ' '}</div>`).join('');
    hlRight.innerHTML = right.split('\n').map(l => `<div class="diff-hl-line">${escapeHtml(l) || ' '}</div>`).join('');
    statsEl.innerHTML = ''; return;
  }

  const diff = computeDiff(left.split('\n'), right.split('\n'));
  const added = diff.filter(d => d.type === 'added').length;
  const removed = diff.filter(d => d.type === 'removed').length;

  let leftHtml = '', rightHtml = '';
  for (const item of diff) {
    if (item.type === 'equal') { leftHtml += `<div class="diff-hl-line">${escapeHtml(item.text) || ' '}</div>`; rightHtml += `<div class="diff-hl-line">${escapeHtml(item.text) || ' '}</div>`; }
    else if (item.type === 'removed') { leftHtml += `<div class="diff-hl-line diff-hl-removed">${escapeHtml(item.text) || ' '}</div>`; rightHtml += `<div class="diff-hl-line diff-hl-empty">&nbsp;</div>`; }
    else if (item.type === 'added') { leftHtml += `<div class="diff-hl-line diff-hl-empty">&nbsp;</div>`; rightHtml += `<div class="diff-hl-line diff-hl-added">${escapeHtml(item.text) || ' '}</div>`; }
  }
  hlLeft.innerHTML = leftHtml;
  hlRight.innerHTML = rightHtml;

  if (added === 0 && removed === 0) statsEl.innerHTML = '<div class="diff-stats"><span style="color:var(--text-light)">两段文本完全相同</span></div>';
  else statsEl.innerHTML = `<div class="diff-stats"><span class="diff-stat-added">+${added} 新增</span><span class="diff-stat-removed">-${removed} 删除</span></div>`;
}

function computeDiff(oldLines, newLines) {
  const m = oldLines.length, n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) { result.unshift({ type: 'equal', text: oldLines[i - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { result.unshift({ type: 'added', text: newLines[j - 1] }); j--; }
    else { result.unshift({ type: 'removed', text: oldLines[i - 1] }); i--; }
  }
  return result;
}

export function diffClear(): void {
  document.getElementById('diffLeft').value = '';
  document.getElementById('diffRight').value = '';
  document.getElementById('diffOutput').innerHTML = '';
  document.getElementById('diffHighlightLeft').innerHTML = '';
  document.getElementById('diffHighlightRight').innerHTML = '';
}

export function initDiffEvents(): void {
  const diffLeft = document.getElementById('diffLeft');
  const diffRight = document.getElementById('diffRight');
  if (diffLeft && diffRight) {
    const doDiff = debounce(() => diffCompare(), 300);
    diffLeft.addEventListener('input', doDiff);
    diffRight.addEventListener('input', doDiff);
    diffLeft.addEventListener('scroll', () => { const hl = document.getElementById('diffHighlightLeft'); if (hl) { hl.scrollTop = diffLeft.scrollTop; hl.scrollLeft = diffLeft.scrollLeft; } });
    diffRight.addEventListener('scroll', () => { const hl = document.getElementById('diffHighlightRight'); if (hl) { hl.scrollTop = diffRight.scrollTop; hl.scrollLeft = diffRight.scrollLeft; } });
  }
}
