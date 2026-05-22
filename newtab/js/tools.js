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
  color: '颜色转换',
  uuid: 'UUID 生成'
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
  
  // 初始化默认工具
  selectTool('json');
});
