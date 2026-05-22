/**
 * LinkHub New Tab - 工具模块
 */

// 工具标题配置
const TOOL_TITLES = {
  json: 'JSON 格式化',
  timestamp: '时间戳转换',
  cron: 'Cron 表达式',
  regex: '正则表达式',
  url: 'URL 编解码',
  base64: 'Base64 编解码',
  jwt: 'JWT 解析',
  hash: 'MD5/SHA 哈希'
};

let currentTool = 'json';
let jsonMode = 'format'; // 'format' 或 'compress'
let currentJsonResult = ''; // 保存原始结果用于复制
let jsonFormatTimer = null; // JSON 格式化防抖定时器
let tsTimer = null; // 时间戳实时更新定时器

// 切换工具 Tab
function selectTool(tool) {
  currentTool = tool;

  // 更新 Tab 激活状态
  document.querySelectorAll('.tools-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tool === tool);
  });

  const jsonPanel = document.getElementById('jsonToolPanel');
  const generalPanel = document.getElementById('generalToolPanel');
  const timestampPanel = document.getElementById('timestampToolPanel');
  const cronPanel = document.getElementById('cronToolPanel');
  const errorEl = document.getElementById('toolError');
  const inputGeneral = document.getElementById('toolInputGeneral');
  const outputGeneral = document.getElementById('toolOutputGeneral');

  errorEl.style.display = 'none';

  // 停止时间戳实时更新
  if (tsTimer) {
    clearInterval(tsTimer);
    tsTimer = null;
  }

  // 隐藏所有面板
  jsonPanel.style.display = 'none';
  generalPanel.style.display = 'none';
  timestampPanel.style.display = 'none';
  cronPanel.style.display = 'none';
  const regexPanel = document.getElementById('regexToolPanel');
  regexPanel.style.display = 'none';
  document.getElementById('urlToolPanel').style.display = 'none';
  document.getElementById('base64ToolPanel').style.display = 'none';
  document.getElementById('jwtToolPanel').style.display = 'none';
  document.getElementById('hashToolPanel').style.display = 'none';

  // JSON 工具使用双栏布局
  if (tool === 'json') {
    jsonPanel.style.display = 'flex';
    document.getElementById('toolInput').value = '';
    document.getElementById('toolOutput').innerHTML = '';

    const outputEl = document.getElementById('toolOutput');
    const outputWrapper = outputEl?.closest('.json-output-wrapper');
    if (outputEl) outputEl.classList.remove('compress-mode');
    if (outputWrapper) outputWrapper.classList.remove('compress-mode');

    setJsonMode('format');
  } else if (tool === 'timestamp') {
    timestampPanel.style.display = 'flex';
    startTimestampTimer();
  } else if (tool === 'cron') {
    cronPanel.style.display = 'flex';
  } else if (tool === 'regex') {
    regexPanel.style.display = 'flex';
  } else if (tool === 'url') {
    const urlPanel = document.getElementById('urlToolPanel');
    urlPanel.style.display = 'flex';
  } else if (tool === 'base64') {
    document.getElementById('base64ToolPanel').style.display = 'flex';
  } else if (tool === 'jwt') {
    document.getElementById('jwtToolPanel').style.display = 'flex';
  } else if (tool === 'hash') {
    document.getElementById('hashToolPanel').style.display = 'flex';
  } else {
    generalPanel.style.display = 'flex';
    inputGeneral.value = '';
    inputGeneral.placeholder = TOOL_TITLES[tool] + '...';
    outputGeneral.textContent = '';
  }
}

// 设置 JSON 模式
function setJsonMode(mode) {
  jsonMode = mode;
  document.querySelectorAll('.json-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // 更新输出区域的样式类
  const outputEl = document.getElementById('toolOutput');
  const outputWrapper = outputEl?.closest('.json-output-wrapper');

  if (outputEl) {
    outputEl.classList.toggle('compress-mode', mode === 'compress');
  }
  if (outputWrapper) {
    outputWrapper.classList.toggle('compress-mode', mode === 'compress');
  }

  // 如果已有输入，重新执行
  const input = document.getElementById('toolInput').value.trim();
  if (input) {
    executeJsonTool();
  }
}

// JSON 语法高亮
function highlightJson(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json);
  }
  
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

// HTML 转义
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 执行 JSON 工具（带防抖）
function executeJsonTool() {
  // 清除之前的定时器
  if (jsonFormatTimer) {
    clearTimeout(jsonFormatTimer);
  }
  
  // 150ms 防抖
  jsonFormatTimer = setTimeout(() => {
    const input = document.getElementById('toolInput').value.trim();
    const outputEl = document.getElementById('toolOutput');
    const errorEl = document.getElementById('toolError');
    
    if (!input) {
      errorEl.style.display = 'none';
      outputEl.innerHTML = '';
      return;
    }
    
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

// 时间戳工具 - 实时更新当前时间戳
function startTimestampTimer() {
  updateCurrentTimestamp();
  tsTimer = setInterval(updateCurrentTimestamp, 1000);
}

function updateCurrentTimestamp() {
  const now = new Date();
  const ts = Math.floor(now.getTime() / 1000);
  document.getElementById('tsNowValue').textContent = ts;
  document.getElementById('tsNowDate').textContent = formatDate(now);
}

// 格式化日期
function formatDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 时间戳转日期
function timestampToDate() {
  const input = document.getElementById('tsToDateInput').value.trim();
  const resultEl = document.getElementById('tsToDateResult');
  const unit = document.getElementById('tsToDateUnit').value;
  const tz = document.getElementById('tsToDateTimezone').value;

  if (!input) {
    resultEl.value = '';
    return;
  }

  if (!/^\d+$/.test(input)) {
    resultEl.value = '请输入有效的数字时间戳';
    return;
  }

  const ts = parseInt(input);
  const ms = unit === 'ms' ? ts : ts * 1000;
  const d = new Date(ms);

  if (isNaN(d.getTime())) {
    resultEl.value = '无效的时间戳';
    return;
  }

  if (tz === 'utc') {
    const pad = n => String(n).padStart(2, '0');
    resultEl.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  } else {
    resultEl.value = formatDate(d);
  }
}

// 日期转时间戳
function dateToTimestamp() {
  const input = document.getElementById('tsToTsInput').value.trim();
  const resultEl = document.getElementById('tsToTsResult');
  const unit = document.getElementById('tsToTsUnit').value;
  const tz = document.getElementById('tsToTsTimezone').value;

  if (!input) {
    resultEl.value = '';
    return;
  }

  let d;
  if (tz === 'utc') {
    // 把输入当作 UTC 时间解析
    d = new Date(input + 'Z');
  } else {
    d = new Date(input);
  }

  if (isNaN(d.getTime())) {
    resultEl.value = '无效的日期格式';
    return;
  }

  if (unit === 'ms') {
    resultEl.value = String(d.getTime());
  } else {
    resultEl.value = String(Math.floor(d.getTime() / 1000));
  }
}

// 使用当前时间填充
function useNowDate() {
  document.getElementById('tsToTsInput').value = formatDate(new Date());
  dateToTimestamp();
}

// Cron 表达式解析
function parseCron() {
  const input = document.getElementById('cronInput').value.trim();
  const descEl = document.getElementById('cronDesc');
  const listEl = document.getElementById('cronNextList');

  if (!input) {
    descEl.innerHTML = '';
    listEl.innerHTML = '';
    return;
  }

  const parts = input.split(/\s+/);
  if (parts.length < 5 || parts.length > 7) {
    descEl.innerHTML = '<span class="cron-error">格式错误：需要 5-7 个字段（秒 分 时 日 月 周 [年]）</span>';
    listEl.innerHTML = '';
    return;
  }

  // 解析描述
  const desc = describeCron(parts);
  descEl.innerHTML = `<span class="cron-desc-text">📝 ${desc}</span>`;

  // 计算下次执行时间
  const nextTimes = getNextCronTimes(parts, 10);
  if (nextTimes.length === 0) {
    listEl.innerHTML = '<div class="cron-error">无法计算执行时间</div>';
  } else {
    listEl.innerHTML = nextTimes.map((t, i) => 
      `<div class="cron-next-item"><span class="cron-next-idx">${i + 1}</span><span class="cron-next-time">${formatDate(t)}</span></div>`
    ).join('');
  }
}

// 描述 Cron 表达式（简单中文描述）
function describeCron(parts) {
  // 支持 6 字段（秒 分 时 日 月 周）和 5 字段（分 时 日 月 周）
  let sec, min, hour, day, month, week;
  if (parts.length >= 6) {
    [sec, min, hour, day, month, week] = parts;
  } else {
    sec = '0';
    [min, hour, day, month, week] = parts;
  }

  const descs = [];

  // 周
  if (week !== '?' && week !== '*') {
    const weekMap = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六', '7': '周日', '0': '周日' };
    if (week.includes('-')) {
      const [s, e] = week.split('-');
      descs.push(`${weekMap[s] || '周' + s}到${weekMap[e] || '周' + e}`);
    } else if (week.includes(',')) {
      descs.push(week.split(',').map(w => weekMap[w] || '周' + w).join('、'));
    } else {
      descs.push(`每${weekMap[week] || '周' + week}`);
    }
  }

  // 月
  if (month !== '*' && month !== '?') {
    descs.push(`${month}月`);
  }

  // 日
  if (day !== '*' && day !== '?') {
    descs.push(`${day}号`);
  }

  // 时
  if (hour === '*') {
    descs.push('每小时');
  } else if (hour.includes('/')) {
    descs.push(`每${hour.split('/')[1]}小时`);
  } else if (hour !== '?') {
    descs.push(`${hour}时`);
  }

  // 分
  if (min === '*') {
    descs.push('每分钟');
  } else if (min.includes('/')) {
    descs.push(`每${min.split('/')[1]}分钟`);
  } else if (min === '0' && hour !== '*') {
    // 整点不显示分钟
  } else {
    descs.push(`${min}分`);
  }

  // 秒
  if (sec !== '0' && sec !== '*') {
    descs.push(`${sec}秒`);
  }

  return descs.join(' ') || '每秒执行';
}

// 计算 Cron 下次执行时间（简化版，支持常见表达式）
function getNextCronTimes(parts, count) {
  let sec, min, hour, day, month, week;
  if (parts.length >= 6) {
    [sec, min, hour, day, month, week] = parts;
  } else {
    sec = '0';
    [min, hour, day, month, week] = parts;
  }

  const results = [];
  const now = new Date();
  let current = new Date(now.getTime() + 1000); // 从下一秒开始
  current.setMilliseconds(0);

  const maxIterations = 100000;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;

    if (matchCronField(month, current.getMonth() + 1) &&
        matchCronDay(day, week, current) &&
        matchCronField(hour, current.getHours()) &&
        matchCronField(min, current.getMinutes()) &&
        matchCronField(sec, current.getSeconds())) {
      results.push(new Date(current));
    }

    // 递增：优先递增秒
    current.setSeconds(current.getSeconds() + 1);
  }

  return results;
}

// 匹配 Cron 字段
function matchCronField(field, value) {
  if (field === '*' || field === '?') return true;

  // 步进 */n 或 start/n
  if (field.includes('/')) {
    const [start, step] = field.split('/');
    const s = start === '*' ? 0 : parseInt(start);
    const st = parseInt(step);
    return (value - s) >= 0 && (value - s) % st === 0;
  }

  // 范围 a-b
  if (field.includes('-') && !field.includes(',')) {
    const [a, b] = field.split('-').map(Number);
    return value >= a && value <= b;
  }

  // 列表 a,b,c
  if (field.includes(',')) {
    return field.split(',').some(f => matchCronField(f, value));
  }

  return parseInt(field) === value;
}

// 匹配日期（日和周的组合）
function matchCronDay(day, week, date) {
  const dayMatch = matchCronField(day, date.getDate());
  // 周：1=周一...7=周日（也兼容 0=周日）
  let jsDay = date.getDay(); // 0=周日, 1=周一...6=周六
  const cronDay = jsDay === 0 ? 7 : jsDay; // 转为 1=周一...7=周日

  if (week === '?' || week === '*') return dayMatch;
  if (day === '?' || day === '*') return matchCronField(week, cronDay);

  // 两者都指定时，满足任一即可
  return dayMatch || matchCronField(week, cronDay);
}

// 复制当前时间戳
function copyCurrentTimestamp() {
  const ts = document.getElementById('tsNowValue').textContent;
  navigator.clipboard.writeText(ts).then(() => showCopyToast());
}

// 正则表达式语法高亮
function highlightRegex(pattern) {
  if (!pattern) return '';

  let html = '';
  let i = 0;
  let groupDepth = 0;
  const groupColors = ['rh-group', 'rh-group-2', 'rh-group-3'];

  while (i < pattern.length) {
    const ch = pattern[i];

    // 转义字符
    if (ch === '\\' && i + 1 < pattern.length) {
      html += `<span class="rh-escape">${escapeHtml(pattern.slice(i, i + 2))}</span>`;
      i += 2;
      continue;
    }

    // 字符集 [...]
    if (ch === '[') {
      let end = i + 1;
      if (end < pattern.length && pattern[end] === '^') end++;
      if (end < pattern.length && pattern[end] === ']') end++;
      while (end < pattern.length && pattern[end] !== ']') {
        if (pattern[end] === '\\') end++;
        end++;
      }
      if (end < pattern.length) end++; // include ]
      html += `<span class="rh-charset">${escapeHtml(pattern.slice(i, end))}</span>`;
      i = end;
      continue;
    }

    // 分组 (...)
    if (ch === '(') {
      const cls = groupColors[groupDepth % groupColors.length];
      html += `<span class="${cls}">(</span>`;
      groupDepth++;
      i++;
      // 检查 (?:  (?=  (?! 等
      if (i < pattern.length && pattern[i] === '?') {
        let prefix = '?';
        i++;
        if (i < pattern.length && (pattern[i] === ':' || pattern[i] === '=' || pattern[i] === '!' || pattern[i] === '<')) {
          prefix += pattern[i];
          i++;
          if (pattern[i - 1] === '<' && i < pattern.length && (pattern[i] === '=' || pattern[i] === '!')) {
            prefix += pattern[i];
            i++;
          }
        }
        html += `<span class="${cls}">${escapeHtml(prefix)}</span>`;
      }
      continue;
    }

    if (ch === ')') {
      groupDepth = Math.max(0, groupDepth - 1);
      const cls = groupColors[groupDepth % groupColors.length];
      html += `<span class="${cls}">)</span>`;
      i++;
      continue;
    }

    // 量词
    if ('*+?'.includes(ch)) {
      html += `<span class="rh-quantifier">${ch}</span>`;
      i++;
      // 非贪婪 ?
      if (i < pattern.length && pattern[i] === '?') {
        html += `<span class="rh-quantifier">?</span>`;
        i++;
      }
      continue;
    }

    // {n,m}
    if (ch === '{') {
      const braceMatch = pattern.slice(i).match(/^\{\d+(?:,\d*)?\}/);
      if (braceMatch) {
        html += `<span class="rh-quantifier">${escapeHtml(braceMatch[0])}</span>`;
        i += braceMatch[0].length;
        continue;
      }
    }

    // 锚点
    if (ch === '^' || ch === '$') {
      html += `<span class="rh-anchor">${ch}</span>`;
      i++;
      continue;
    }

    // 或
    if (ch === '|') {
      html += `<span class="rh-alternation">|</span>`;
      i++;
      continue;
    }

    // 普通字符
    html += escapeHtml(ch);
    i++;
  }

  return html;
}

// 更新正则高亮层
function updateRegexHighlight() {
  const pattern = document.getElementById('regexPattern').value;
  const highlightEl = document.getElementById('regexHighlight');
  highlightEl.innerHTML = highlightRegex(pattern);
}

// 正则表达式测试
function testRegex() {
  const pattern = document.getElementById('regexPattern').value;
  const flags = document.getElementById('regexFlags').value.trim();
  const testStr = document.getElementById('regexTestStr').value;
  const resultEl = document.getElementById('regexResult');
  const testHighlight = document.getElementById('regexTestHighlight');

  if (!pattern) {
    resultEl.innerHTML = '<span class="regex-hint">输入正则表达式开始匹配</span>';
    testHighlight.innerHTML = escapeHtml(testStr);
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    
    if (!testStr) {
      resultEl.innerHTML = '<span class="regex-hint">正则表达式有效 ✓</span>';
      testHighlight.innerHTML = '';
      return;
    }

    // 收集匹配结果（包含分组信息）
    const matches = [];
    let match;

    if (flags.includes('g')) {
      while ((match = regex.exec(testStr)) !== null) {
        matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
        if (match[0].length === 0) regex.lastIndex++;
      }
    } else {
      match = regex.exec(testStr);
      if (match) {
        matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
      }
    }

    if (matches.length === 0) {
      resultEl.innerHTML = '<span class="regex-no-match">无匹配结果</span>';
      testHighlight.innerHTML = escapeHtml(testStr);
      return;
    }

    // 高亮测试字符串中的匹配（按分组着色）
    const groupColors = ['rh-match-1', 'rh-match-2', 'rh-match-3', 'rh-match-4', 'rh-match-5', 'rh-match-6', 'rh-match-7'];
    let highlighted = '';
    let lastIdx = 0;

    for (const m of matches) {
      // 匹配前的普通文本
      if (m.index > lastIdx) {
        highlighted += escapeHtml(testStr.slice(lastIdx, m.index));
      }

      if (m.groups.length > 0 && m.groups.some(g => g !== undefined)) {
        // 有捕获分组：逐个分组高亮，分组间用分隔符
        let groupOffset = m.index;
        let matchContent = m.text;
        let innerHtml = '';
        let innerIdx = 0;

        for (let gi = 0; gi < m.groups.length; gi++) {
          const g = m.groups[gi];
          if (g === undefined) continue;
          const gStart = matchContent.indexOf(g, innerIdx);
          if (gStart === -1) continue;

          // 分组前的文本
          if (gStart > innerIdx) {
            innerHtml += `<span class="rh-match">${escapeHtml(matchContent.slice(innerIdx, gStart))}</span>`;
            innerHtml += '<span class="rh-match-sep"></span>';
          }

          const cls = groupColors[gi % groupColors.length];
          innerHtml += `<span class="${cls}">${escapeHtml(g)}</span>`;
          innerIdx = gStart + g.length;

          if (gi < m.groups.length - 1 && m.groups[gi + 1] !== undefined) {
            innerHtml += '<span class="rh-match-sep"></span>';
          }
        }

        // 分组后剩余文本
        if (innerIdx < matchContent.length) {
          if (innerHtml) innerHtml += '<span class="rh-match-sep"></span>';
          innerHtml += `<span class="rh-match">${escapeHtml(matchContent.slice(innerIdx))}</span>`;
        }

        highlighted += innerHtml;
      } else {
        // 无分组：整体高亮
        highlighted += `<span class="rh-match">${escapeHtml(m.text)}</span>`;
      }

      lastIdx = m.index + m.text.length;
    }

    // 剩余文本
    if (lastIdx < testStr.length) {
      highlighted += escapeHtml(testStr.slice(lastIdx));
    }

    testHighlight.innerHTML = highlighted;

    // 渲染结果表格
    const colors = ['#2b7bd0', '#e8a027', '#28a745', '#6f42c1', '#e91e63', '#00bcd4', '#8bc34a'];
    let html = '<div class="regex-match-table">';

    matches.forEach((m, mi) => {
      if (m.groups.length > 0 && m.groups.some(g => g !== undefined)) {
        m.groups.forEach((g, gi) => {
          if (g === undefined) return;
          const gColor = colors[gi % colors.length];
          const gStart = testStr.indexOf(g, m.index);
          const gEnd = gStart + g.length;
          html += `
            <div class="regex-match-row">
              <span class="regex-match-label" style="border-bottom-color:${gColor}">Group ${gi + 1}</span>
              <span class="regex-match-pos">${gStart}-${gEnd}</span>
              <span class="regex-match-value">${escapeHtml(g)}</span>
            </div>
          `;
        });
      } else {
        const matchEnd = m.index + m.text.length;
        const color = colors[mi % colors.length];
        html += `
          <div class="regex-match-row">
            <span class="regex-match-label" style="border-bottom-color:${color}">Match ${mi + 1}</span>
            <span class="regex-match-pos">${m.index}-${matchEnd}</span>
            <span class="regex-match-value">${escapeHtml(m.text)}</span>
          </div>
        `;
      }
    });

    html += '</div>';
    resultEl.innerHTML = html;
  } catch (e) {
    resultEl.innerHTML = `<span class="regex-error">正则错误: ${escapeHtml(e.message)}</span>`;
    testHighlight.innerHTML = escapeHtml(testStr);
  }
}

// URL 编解码
function urlEncode() {
  const input = document.getElementById('urlInput').value;
  document.getElementById('urlOutput').value = encodeURIComponent(input);
}

function urlDecode() {
  const input = document.getElementById('urlInput').value;
  try {
    document.getElementById('urlOutput').value = decodeURIComponent(input);
  } catch (e) {
    document.getElementById('urlOutput').value = '解码失败: ' + e.message;
  }
}

function urlSwap() {
  const input = document.getElementById('urlInput');
  const output = document.getElementById('urlOutput');
  const temp = output.value;
  input.value = temp;
  output.value = '';
}

function urlClear() {
  document.getElementById('urlInput').value = '';
  document.getElementById('urlOutput').value = '';
}

// Base64 编解码
function base64Encode() {
  const input = document.getElementById('base64Input').value;
  try {
    document.getElementById('base64Output').value = btoa(unescape(encodeURIComponent(input)));
  } catch (e) {
    document.getElementById('base64Output').value = '编码失败: ' + e.message;
  }
}

function base64Decode() {
  const input = document.getElementById('base64Input').value;
  try {
    document.getElementById('base64Output').value = decodeURIComponent(escape(atob(input)));
  } catch (e) {
    document.getElementById('base64Output').value = '解码失败: ' + e.message;
  }
}

function base64Swap() {
  const input = document.getElementById('base64Input');
  const output = document.getElementById('base64Output');
  const temp = output.value;
  input.value = temp;
  output.value = '';
}

function base64Clear() {
  document.getElementById('base64Input').value = '';
  document.getElementById('base64Output').value = '';
}

// JWT 解析
function parseJwt() {
  const input = document.getElementById('jwtInput').value.trim();
  const resultEl = document.getElementById('jwtResult');

  if (!input) {
    resultEl.innerHTML = '<div class="jwt-placeholder">粘贴 JWT Token 后自动解析</div>';
    return;
  }

  const parts = input.split('.');
  if (parts.length !== 3) {
    resultEl.innerHTML = '<div class="jwt-error">无效的 JWT 格式（需要 3 段由 . 分隔）</div>';
    return;
  }

  // Base64URL 解码（支持 UTF-8）
  function decodeBase64Url(str) {
    // 补齐 padding
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    // 解码为字节数组再转 UTF-8
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));

    // 处理时间字段
    const timeFields = ['exp', 'iat', 'nbf'];
    let payloadExtra = '';
    for (const field of timeFields) {
      if (payload[field]) {
        const d = new Date(payload[field] * 1000);
        payloadExtra += `<div class="jwt-time-hint">${field}: ${d.toLocaleString('zh-CN')}${field === 'exp' ? (d < new Date() ? ' (已过期)' : ' (有效)') : ''}</div>`;
      }
    }

    resultEl.innerHTML = `
      <div class="jwt-part">
        <div class="jwt-part-header">
          <span class="jwt-part-label jwt-header-color">HEADER</span>
          <span class="jwt-part-alg">${escapeHtml(header.alg || '')}</span>
        </div>
        <pre class="jwt-part-content">${escapeHtml(JSON.stringify(header, null, 2))}</pre>
      </div>
      <div class="jwt-part">
        <div class="jwt-part-header">
          <span class="jwt-part-label jwt-payload-color">PAYLOAD</span>
        </div>
        <pre class="jwt-part-content">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
        ${payloadExtra}
      </div>
      <div class="jwt-part">
        <div class="jwt-part-header">
          <span class="jwt-part-label jwt-signature-color">SIGNATURE</span>
        </div>
        <pre class="jwt-part-content jwt-signature">${escapeHtml(parts[2])}</pre>
      </div>
    `;
  } catch (e) {
    resultEl.innerHTML = `<div class="jwt-error">解析失败: ${escapeHtml(e.message)}</div>`;
  }
}

// MD5/SHA 哈希 - 计算所有哈希值
async function computeAllHashes() {
  const input = document.getElementById('hashInput').value;
  const outputEl = document.getElementById('hashOutput');

  if (!input) {
    outputEl.innerHTML = '';
    return;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // MD5
    const md5Hash = md5(input);

    // SHA-1, SHA-256, SHA-512
    const [sha1Buf, sha256Buf, sha512Buf] = await Promise.all([
      crypto.subtle.digest('SHA-1', data),
      crypto.subtle.digest('SHA-256', data),
      crypto.subtle.digest('SHA-512', data)
    ]);

    const toHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

    outputEl.innerHTML = `
      <div class="hash-result-item">
        <span class="hash-result-label">MD5</span>
        <code class="hash-result-value">${md5Hash}</code>
        <button class="btn btn-sm btn-secondary hash-copy-btn" data-action="copy-hash" data-hash="${md5Hash}">复制</button>
      </div>
      <div class="hash-result-item">
        <span class="hash-result-label">SHA-1</span>
        <code class="hash-result-value">${toHex(sha1Buf)}</code>
        <button class="btn btn-sm btn-secondary hash-copy-btn" data-action="copy-hash" data-hash="${toHex(sha1Buf)}">复制</button>
      </div>
      <div class="hash-result-item">
        <span class="hash-result-label">SHA-256</span>
        <code class="hash-result-value">${toHex(sha256Buf)}</code>
        <button class="btn btn-sm btn-secondary hash-copy-btn" data-action="copy-hash" data-hash="${toHex(sha256Buf)}">复制</button>
      </div>
      <div class="hash-result-item">
        <span class="hash-result-label">SHA-512</span>
        <code class="hash-result-value">${toHex(sha512Buf)}</code>
        <button class="btn btn-sm btn-secondary hash-copy-btn" data-action="copy-hash" data-hash="${toHex(sha512Buf)}">复制</button>
      </div>
    `;
  } catch (e) {
    outputEl.innerHTML = `<div class="jwt-error">计算失败: ${e.message}</div>`;
  }
}

function hashClear() {
  document.getElementById('hashInput').value = '';
  document.getElementById('hashOutput').innerHTML = '';
}

function copyHash(hash) {
  navigator.clipboard.writeText(hash).then(() => showCopyToast());
}

// MD5 纯 JS 实现
function md5(string) {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function md51(s) {
    const n = s.length;
    let state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    const tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    return md5blks;
  }
  function rhex(n) { let s = ''; for (let j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8 + 4)) & 0x0F).toString(16) + (n >> (j * 8) & 0x0F).toString(16)); return s; }
  function hex(x) { for (let i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join(''); }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
  // 处理 UTF-8
  const utf8 = unescape(encodeURIComponent(string));
  return hex(md51(utf8));
}

// 执行工具
function executeTool() {
  const { rgbToHsl, generateUUID } = window.LinkHubUtils;
  const input = document.getElementById('toolInputGeneral').value;
  const outputEl = document.getElementById('toolOutputGeneral');
  const errorEl = document.getElementById('toolError');
  
  try {
    let result;
    switch (currentTool) {
      case 'timestamp':
        const ts = input.trim();
        if (/^\d+$/.test(ts)) {
          const ms = ts.length > 10 ? parseInt(ts) : parseInt(ts) * 1000;
          const d = new Date(ms);
          result = `毫秒: ${d.getTime()}\n秒: ${Math.floor(d.getTime() / 1000)}\n日期: ${d.toLocaleString('zh-CN')}\nISO: ${d.toISOString()}`;
        } else {
          const d = new Date(ts);
          if (isNaN(d.getTime())) {
            result = '无效的日期格式';
          } else {
            result = `毫秒: ${d.getTime()}\n秒: ${Math.floor(d.getTime() / 1000)}`;
          }
        }
        break;
        
      case 'url':
        result = encodeURIComponent(input);
        break;
        
      case 'base64':
        result = btoa(unescape(encodeURIComponent(input)));
        break;
        
      case 'color':
        const hex = input.trim();
        if (hex.startsWith('#')) {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          result = `RGB: rgb(${r}, ${g}, ${b})\nHSL: hsl(${rgbToHsl(r, g, b)})`;
        } else if (hex.startsWith('rgb')) {
          const match = hex.match(/\d+/g);
          if (match && match.length >= 3) {
            result = `#${match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`;
          }
        } else {
          result = '请输入有效的颜色值（如 #ff0000 或 rgb(255,0,0)）';
        }
        break;
        
      case 'uuid':
        result = generateUUID();
        break;
        
      default:
        result = '未知工具';
    }
    outputEl.textContent = result;
    errorEl.style.display = 'none';
  } catch (err) {
    errorEl.textContent = '错误: ' + err.message;
    errorEl.style.display = 'block';
    outputEl.textContent = '';
  }
}

// 显示复制成功提示
function showCopyToast() {
  const existing = document.querySelector('.copy-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = '✓ 已复制到剪贴板';
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 1500);
}

// 复制结果
function copyToolResult() {
  let result = currentJsonResult;
  
  if (currentTool === 'json' && result) {
    // JSON 工具：复制纯文本
    try {
      const parsed = JSON.parse(result);
      result = jsonMode === 'format' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
    } catch (e) {
      result = currentJsonResult;
    }
  } else {
    result = document.getElementById('toolOutputGeneral').textContent;
  }
  
  if (result) {
    navigator.clipboard.writeText(result).then(() => {
      showCopyToast();
    });
  }
}

// 清空
function clearTool() {
  if (currentTool === 'json') {
    document.getElementById('toolInput').value = '';
    document.getElementById('toolOutput').innerHTML = '';
  } else {
    document.getElementById('toolInputGeneral').value = '';
    document.getElementById('toolOutputGeneral').innerHTML = '';
  }
  document.getElementById('toolError').style.display = 'none';
  currentJsonResult = '';
}

// 暴露到全局
window.LinkHubTools = {
  TOOL_TITLES,
  selectTool,
  setJsonMode,
  executeTool,
  copyToolResult,
  clearTool,
  timestampToDate,
  dateToTimestamp,
  useNowDate,
  copyCurrentTimestamp,
  parseCron,
  testRegex,
  urlEncode,
  urlDecode,
  urlSwap,
  urlClear,
  base64Encode,
  base64Decode,
  base64Swap,
  base64Clear,
  parseJwt,
  computeAllHashes,
  hashClear,
  copyHash,
  get currentTool() { return currentTool; }
};

// 初始化工具 Tab 事件
document.addEventListener('DOMContentLoaded', () => {
  // JSON 输入实时格式化
  const jsonInput = document.getElementById('toolInput');
  if (jsonInput) {
    jsonInput.addEventListener('input', () => {
      if (currentTool === 'json') {
        executeJsonTool();
      }
    });
  }

  // 时间戳输入实时转换
  const tsToDateInput = document.getElementById('tsToDateInput');
  if (tsToDateInput) {
    tsToDateInput.addEventListener('input', () => timestampToDate());
  }
  const tsToTsInput = document.getElementById('tsToTsInput');
  if (tsToTsInput) {
    tsToTsInput.addEventListener('input', () => dateToTimestamp());
  }

  // 下拉选择变化时重新转换
  ['tsToDateUnit', 'tsToDateTimezone', 'tsToTsTimezone', 'tsToTsUnit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (id.startsWith('tsToDate')) timestampToDate();
        else dateToTimestamp();
      });
    }
  });

  // Cron 输入实时解析
  const cronInput = document.getElementById('cronInput');
  if (cronInput) {
    cronInput.addEventListener('input', () => parseCron());
  }

  // Cron 参考表达式点击填入
  document.getElementById('cronToolPanel')?.addEventListener('click', (e) => {
    const refItem = e.target.closest('.cron-ref-item');
    if (refItem && refItem.dataset.cron) {
      document.getElementById('cronInput').value = refItem.dataset.cron;
      parseCron();
    }
  });

  // 正则表达式实时匹配
  ['regexPattern', 'regexFlags', 'regexTestStr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (id === 'regexPattern') updateRegexHighlight();
        testRegex();
      });
    }
  });

  // 同步正则输入框滚动
  const regexInput = document.getElementById('regexPattern');
  if (regexInput) {
    regexInput.addEventListener('scroll', () => {
      document.getElementById('regexHighlight').scrollLeft = regexInput.scrollLeft;
    });
  }

  // 同步测试字符串滚动
  const regexTestStr = document.getElementById('regexTestStr');
  if (regexTestStr) {
    regexTestStr.addEventListener('scroll', () => {
      const hl = document.getElementById('regexTestHighlight');
      hl.scrollTop = regexTestStr.scrollTop;
      hl.scrollLeft = regexTestStr.scrollLeft;
    });
  }

  // JWT 自动解析
  const jwtInput = document.getElementById('jwtInput');
  if (jwtInput) {
    jwtInput.addEventListener('input', () => parseJwt());
  }

  // 哈希实时计算
  const hashInput = document.getElementById('hashInput');
  if (hashInput) {
    hashInput.addEventListener('input', window.LinkHubUtils.debounce(() => computeAllHashes(), 300));
  }
  
  // 初始化默认工具
  selectTool('json');
});
