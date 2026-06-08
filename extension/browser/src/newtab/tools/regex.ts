/**
 * 正则表达式测试工具
 */
// @ts-nocheck

import { escapeHtml } from '../utils';

export function updateRegexHighlight(): void {
  const pattern = document.getElementById('regexPattern').value;
  const highlightEl = document.getElementById('regexHighlight');
  highlightEl.innerHTML = highlightRegex(pattern);
}

export function testRegex(): void {
  const pattern = document.getElementById('regexPattern').value;
  const flags = document.getElementById('regexFlags').value.trim();
  const testStr = document.getElementById('regexTestStr').value;
  const resultEl = document.getElementById('regexResult');
  const testHighlight = document.getElementById('regexTestHighlight');

  if (!pattern) { resultEl.innerHTML = '<span class="regex-hint">输入正则表达式开始匹配</span>'; testHighlight.innerHTML = escapeHtml(testStr); return; }

  try {
    const regex = new RegExp(pattern, flags);
    if (!testStr) { resultEl.innerHTML = '<span class="regex-hint">正则表达式有效 ✓</span>'; testHighlight.innerHTML = ''; return; }

    const matches = [];
    let match;
    if (flags.includes('g')) {
      while ((match = regex.exec(testStr)) !== null) { matches.push({ index: match.index, text: match[0], groups: match.slice(1) }); if (match[0].length === 0) regex.lastIndex++; }
    } else {
      match = regex.exec(testStr);
      if (match) matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
    }

    if (matches.length === 0) { resultEl.innerHTML = '<span class="regex-no-match">无匹配结果</span>'; testHighlight.innerHTML = escapeHtml(testStr); return; }

    const groupColors = ['rh-match-1', 'rh-match-2', 'rh-match-3', 'rh-match-4', 'rh-match-5', 'rh-match-6', 'rh-match-7'];
    let highlighted = '';
    let lastIdx = 0;

    for (const m of matches) {
      if (m.index > lastIdx) highlighted += escapeHtml(testStr.slice(lastIdx, m.index));
      if (m.groups.length > 0 && m.groups.some(g => g !== undefined)) {
        let innerHtml = '', innerIdx = 0;
        for (let gi = 0; gi < m.groups.length; gi++) {
          const g = m.groups[gi]; if (g === undefined) continue;
          const gStart = m.text.indexOf(g, innerIdx); if (gStart === -1) continue;
          if (gStart > innerIdx) { innerHtml += `<span class="rh-match">${escapeHtml(m.text.slice(innerIdx, gStart))}</span><span class="rh-match-sep"></span>`; }
          innerHtml += `<span class="${groupColors[gi % groupColors.length]}">${escapeHtml(g)}</span>`;
          innerIdx = gStart + g.length;
          if (gi < m.groups.length - 1 && m.groups[gi + 1] !== undefined) innerHtml += '<span class="rh-match-sep"></span>';
        }
        if (innerIdx < m.text.length) { if (innerHtml) innerHtml += '<span class="rh-match-sep"></span>'; innerHtml += `<span class="rh-match">${escapeHtml(m.text.slice(innerIdx))}</span>`; }
        highlighted += innerHtml;
      } else {
        highlighted += `<span class="rh-match">${escapeHtml(m.text)}</span>`;
      }
      lastIdx = m.index + m.text.length;
    }
    if (lastIdx < testStr.length) highlighted += escapeHtml(testStr.slice(lastIdx));
    testHighlight.innerHTML = highlighted;

    const colors = ['#2b7bd0', '#e8a027', '#28a745', '#6f42c1', '#e91e63', '#00bcd4', '#8bc34a'];
    let html = '<div class="regex-match-table">';
    matches.forEach((m, mi) => {
      if (m.groups.length > 0 && m.groups.some(g => g !== undefined)) {
        m.groups.forEach((g, gi) => { if (g === undefined) return; const gStart = testStr.indexOf(g, m.index); html += `<div class="regex-match-row"><span class="regex-match-label" style="border-bottom-color:${colors[gi % colors.length]}">Group ${gi + 1}</span><span class="regex-match-pos">${gStart}-${gStart + g.length}</span><span class="regex-match-value">${escapeHtml(g)}</span></div>`; });
      } else {
        html += `<div class="regex-match-row"><span class="regex-match-label" style="border-bottom-color:${colors[mi % colors.length]}">Match ${mi + 1}</span><span class="regex-match-pos">${m.index}-${m.index + m.text.length}</span><span class="regex-match-value">${escapeHtml(m.text)}</span></div>`;
      }
    });
    resultEl.innerHTML = html + '</div>';
  } catch (e) {
    resultEl.innerHTML = `<span class="regex-error">正则错误: ${escapeHtml(e.message)}</span>`;
    testHighlight.innerHTML = escapeHtml(testStr);
  }
}

function highlightRegex(pattern) {
  if (!pattern) return '';
  let html = '', i = 0, groupDepth = 0;
  const groupColors = ['rh-group', 'rh-group-2', 'rh-group-3'];
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) { html += `<span class="rh-escape">${escapeHtml(pattern.slice(i, i + 2))}</span>`; i += 2; continue; }
    if (ch === '[') { let end = i + 1; if (end < pattern.length && pattern[end] === '^') end++; if (end < pattern.length && pattern[end] === ']') end++; while (end < pattern.length && pattern[end] !== ']') { if (pattern[end] === '\\') end++; end++; } if (end < pattern.length) end++; html += `<span class="rh-charset">${escapeHtml(pattern.slice(i, end))}</span>`; i = end; continue; }
    if (ch === '(') { const cls = groupColors[groupDepth % groupColors.length]; html += `<span class="${cls}">(</span>`; groupDepth++; i++; if (i < pattern.length && pattern[i] === '?') { let prefix = '?'; i++; if (i < pattern.length && ':=!<'.includes(pattern[i])) { prefix += pattern[i]; i++; if (pattern[i - 1] === '<' && i < pattern.length && '=!'.includes(pattern[i])) { prefix += pattern[i]; i++; } } html += `<span class="${cls}">${escapeHtml(prefix)}</span>`; } continue; }
    if (ch === ')') { groupDepth = Math.max(0, groupDepth - 1); html += `<span class="${groupColors[groupDepth % groupColors.length]}">)</span>`; i++; continue; }
    if ('*+?'.includes(ch)) { html += `<span class="rh-quantifier">${ch}</span>`; i++; if (i < pattern.length && pattern[i] === '?') { html += `<span class="rh-quantifier">?</span>`; i++; } continue; }
    if (ch === '{') { const m = pattern.slice(i).match(/^\{\d+(?:,\d*)?\}/); if (m) { html += `<span class="rh-quantifier">${escapeHtml(m[0])}</span>`; i += m[0].length; continue; } }
    if (ch === '^' || ch === '$') { html += `<span class="rh-anchor">${ch}</span>`; i++; continue; }
    if (ch === '|') { html += `<span class="rh-alternation">|</span>`; i++; continue; }
    html += escapeHtml(ch); i++;
  }
  return html;
}

export function initRegexEvents(): void {
  ['regexPattern', 'regexFlags', 'regexTestStr'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => { if (id === 'regexPattern') updateRegexHighlight(); testRegex(); });
  });
  const regexInput = document.getElementById('regexPattern');
  regexInput?.addEventListener('scroll', () => { const hl = document.getElementById('regexHighlight'); if (hl) hl.scrollLeft = regexInput.scrollLeft; });
  const regexTestStr = document.getElementById('regexTestStr');
  regexTestStr?.addEventListener('scroll', () => { const hl = document.getElementById('regexTestHighlight'); if (hl) { hl.scrollTop = regexTestStr.scrollTop; hl.scrollLeft = regexTestStr.scrollLeft; } });
}
