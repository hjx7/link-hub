/**
 * 时间戳转换工具
 */
// @ts-nocheck

import { formatDate } from './shared';
import { showCopyToast } from './shared';

let tsTimer: ReturnType<typeof setInterval> | null = null;

export function startTimestampTimer(): void {
  updateCurrentTimestamp();
  tsTimer = setInterval(updateCurrentTimestamp, 1000);
}

export function stopTimestampTimer(): void {
  if (tsTimer) { clearInterval(tsTimer); tsTimer = null; }
}

function updateCurrentTimestamp(): void {
  const now = new Date();
  const ts = Math.floor(now.getTime() / 1000);
  document.getElementById('tsNowValue').textContent = String(ts);
  document.getElementById('tsNowDate').textContent = formatDate(now);
}

export function timestampToDate(): void {
  const input = document.getElementById('tsToDateInput').value.trim();
  const resultEl = document.getElementById('tsToDateResult');
  const unit = document.getElementById('tsToDateUnit').value;
  const tz = document.getElementById('tsToDateTimezone').value;

  if (!input) { resultEl.value = ''; return; }
  if (!/^\d+$/.test(input)) { resultEl.value = '请输入有效的数字时间戳'; return; }

  const ts = parseInt(input);
  const ms = unit === 'ms' ? ts : ts * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) { resultEl.value = '无效的时间戳'; return; }

  if (tz === 'utc') {
    const pad = (n: number) => String(n).padStart(2, '0');
    resultEl.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  } else {
    resultEl.value = formatDate(d);
  }
}

export function dateToTimestamp(): void {
  const input = document.getElementById('tsToTsInput').value.trim();
  const resultEl = document.getElementById('tsToTsResult');
  const unit = document.getElementById('tsToTsUnit').value;
  const tz = document.getElementById('tsToTsTimezone').value;

  if (!input) { resultEl.value = ''; return; }
  const d = tz === 'utc' ? new Date(input + 'Z') : new Date(input);
  if (isNaN(d.getTime())) { resultEl.value = '无效的日期格式'; return; }

  resultEl.value = unit === 'ms' ? String(d.getTime()) : String(Math.floor(d.getTime() / 1000));
}

export function copyCurrentTimestamp(): void {
  const ts = document.getElementById('tsNowValue')?.textContent || '';
  navigator.clipboard.writeText(ts).then(() => showCopyToast());
}

export function initTimestampEvents(): void {
  document.getElementById('tsToDateInput')?.addEventListener('input', () => timestampToDate());
  document.getElementById('tsToTsInput')?.addEventListener('input', () => dateToTimestamp());
  ['tsToDateUnit', 'tsToDateTimezone', 'tsToTsTimezone', 'tsToTsUnit'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (id.startsWith('tsToDate')) timestampToDate();
      else dateToTimestamp();
    });
  });
}
