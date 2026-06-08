/**
 * Cron 表达式解析工具
 */
// @ts-nocheck

import { formatDate } from './shared';

export function parseCron(): void {
  const input = document.getElementById('cronInput').value.trim();
  const descEl = document.getElementById('cronDesc');
  const listEl = document.getElementById('cronNextList');

  if (!input) { descEl.innerHTML = ''; listEl.innerHTML = ''; return; }

  const parts = input.split(/\s+/);
  if (parts.length < 5 || parts.length > 7) {
    descEl.innerHTML = '<span class="cron-error">格式错误：需要 5-7 个字段（秒 分 时 日 月 周 [年]）</span>';
    listEl.innerHTML = '';
    return;
  }

  descEl.innerHTML = `<span class="cron-desc-text">📝 ${describeCron(parts)}</span>`;

  const nextTimes = getNextCronTimes(parts, 10);
  if (nextTimes.length === 0) {
    listEl.innerHTML = '<div class="cron-error">无法计算执行时间</div>';
  } else {
    listEl.innerHTML = nextTimes.map((t, i) =>
      `<div class="cron-next-item"><span class="cron-next-idx">${i + 1}</span><span class="cron-next-time">${formatDate(t)}</span></div>`
    ).join('');
  }
}

function describeCron(parts) {
  let sec, min, hour, day, month, week;
  if (parts.length >= 6) { [sec, min, hour, day, month, week] = parts; }
  else { sec = '0'; [min, hour, day, month, week] = parts; }

  const descs = [];
  const weekMap = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六', '7': '周日', '0': '周日' };

  if (week !== '?' && week !== '*') {
    if (week.includes('-')) { const [s, e] = week.split('-'); descs.push(`${weekMap[s] || '周' + s}到${weekMap[e] || '周' + e}`); }
    else if (week.includes(',')) { descs.push(week.split(',').map(w => weekMap[w] || '周' + w).join('、')); }
    else { descs.push(`每${weekMap[week] || '周' + week}`); }
  }
  if (month !== '*' && month !== '?') descs.push(`${month}月`);
  if (day !== '*' && day !== '?') descs.push(`${day}号`);
  if (hour === '*') descs.push('每小时');
  else if (hour.includes('/')) descs.push(`每${hour.split('/')[1]}小时`);
  else if (hour !== '?') descs.push(`${hour}时`);
  if (min === '*') descs.push('每分钟');
  else if (min.includes('/')) descs.push(`每${min.split('/')[1]}分钟`);
  else if (min === '0' && hour !== '*') { /* 整点不显示分钟 */ }
  else descs.push(`${min}分`);
  if (sec !== '0' && sec !== '*') descs.push(`${sec}秒`);

  return descs.join(' ') || '每秒执行';
}

function getNextCronTimes(parts, count) {
  let sec, min, hour, day, month, week;
  if (parts.length >= 6) { [sec, min, hour, day, month, week] = parts; }
  else { sec = '0'; [min, hour, day, month, week] = parts; }

  const results = [];
  const now = new Date();
  let current = new Date(now.getTime() + 1000);
  current.setMilliseconds(0);
  let iterations = 0;

  while (results.length < count && iterations < 100000) {
    iterations++;
    if (matchField(month, current.getMonth() + 1) && matchDay(day, week, current) &&
        matchField(hour, current.getHours()) && matchField(min, current.getMinutes()) &&
        matchField(sec, current.getSeconds())) {
      results.push(new Date(current));
    }
    current.setSeconds(current.getSeconds() + 1);
  }
  return results;
}

function matchField(field, value) {
  if (field === '*' || field === '?') return true;
  if (field.includes('/')) { const [start, step] = field.split('/'); const s = start === '*' ? 0 : parseInt(start); return (value - s) >= 0 && (value - s) % parseInt(step) === 0; }
  if (field.includes('-') && !field.includes(',')) { const [a, b] = field.split('-').map(Number); return value >= a && value <= b; }
  if (field.includes(',')) return field.split(',').some(f => matchField(f, value));
  return parseInt(field) === value;
}

function matchDay(day, week, date) {
  const dayMatch = matchField(day, date.getDate());
  const jsDay = date.getDay();
  const cronDay = jsDay === 0 ? 7 : jsDay;
  if (week === '?' || week === '*') return dayMatch;
  if (day === '?' || day === '*') return matchField(week, cronDay);
  return dayMatch || matchField(week, cronDay);
}

export function initCronEvents(): void {
  document.getElementById('cronInput')?.addEventListener('input', () => parseCron());
  document.getElementById('cronToolPanel')?.addEventListener('click', (e) => {
    const refItem = (e.target as HTMLElement).closest('.cron-ref-item') as HTMLElement | null;
    if (refItem?.dataset.cron) {
      (document.getElementById('cronInput') as HTMLInputElement).value = refItem.dataset.cron;
      parseCron();
    }
  });
}
