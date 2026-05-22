/**
 * LinkHub New Tab - 工具模块
 */

// 工具标题配置
const TOOL_TITLES = {
  json: 'JSON 格式化',
  timestamp: '时间戳转换',
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
  const errorEl = document.getElementById('toolError');
  const inputGeneral = document.getElementById('toolInputGeneral');
  const outputGeneral = document.getElementById('toolOutputGeneral');

  errorEl.style.display = 'none';

  // 停止时间戳实时更新
  if (tsTimer) {
    clearInterval(tsTimer);
    tsTimer = null;
  }

  // JSON 工具使用双栏布局
  if (tool === 'json') {
    jsonPanel.style.display = 'flex';
    generalPanel.style.display = 'none';
    timestampPanel.style.display = 'none';
    document.getElementById('toolInput').value = '';
    document.getElementById('toolOutput').innerHTML = '';

    const outputEl = document.getElementById('toolOutput');
    const outputWrapper = outputEl?.closest('.json-output-wrapper');
    if (outputEl) outputEl.classList.remove('compress-mode');
    if (outputWrapper) outputWrapper.classList.remove('compress-mode');

    setJsonMode('format');
  } else if (tool === 'timestamp') {
    jsonPanel.style.display = 'none';
    generalPanel.style.display = 'none';
    timestampPanel.style.display = 'flex';
    startTimestampTimer();
  } else {
    jsonPanel.style.display = 'none';
    generalPanel.style.display = 'none';
    timestampPanel.style.display = 'none';
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

// 复制当前时间戳
function copyCurrentTimestamp() {
  const ts = document.getElementById('tsNowValue').textContent;
  navigator.clipboard.writeText(ts).then(() => showCopyToast());
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
  
  // 初始化默认工具
  selectTool('json');
});
