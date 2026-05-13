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

let currentTool = null;

// 打开工具
function openTool(tool) {
  currentTool = tool;
  document.getElementById('toolTitle').textContent = TOOL_TITLES[tool] || tool;
  document.getElementById('toolInput').value = '';
  document.getElementById('toolOutput').textContent = '';
  document.getElementById('toolPanel').style.display = 'block';
}

// 关闭工具
function closeTool() {
  document.getElementById('toolPanel').style.display = 'none';
  currentTool = null;
}

// 执行工具
function executeTool() {
  const { rgbToHsl, generateUUID } = window.LinkHubUtils;
  const input = document.getElementById('toolInput').value;
  const outputEl = document.getElementById('toolOutput');
  
  try {
    let result;
    switch (currentTool) {
      case 'json':
        const parsed = JSON.parse(input);
        result = JSON.stringify(parsed, null, 2);
        break;
        
      case 'timestamp':
        const ts = input.trim();
        if (/^\d+$/.test(ts)) {
          // 输入是数字，假设是毫秒或秒
          const ms = ts.length > 10 ? parseInt(ts) : parseInt(ts) * 1000;
          const d = new Date(ms);
          result = `毫秒: ${d.getTime()}\n秒: ${Math.floor(d.getTime() / 1000)}\n日期: ${d.toLocaleString('zh-CN')}\nISO: ${d.toISOString()}`;
        } else {
          // 输入是日期字符串
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
        // 简单的颜色转换
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
  } catch (err) {
    outputEl.textContent = '错误: ' + err.message;
  }
}

// 复制结果
function copyToolResult() {
  const result = document.getElementById('toolOutput').textContent;
  if (result) {
    navigator.clipboard.writeText(result);
  }
}

// 清空
function clearTool() {
  document.getElementById('toolInput').value = '';
  document.getElementById('toolOutput').textContent = '';
}

// 暴露到全局
window.LinkHubTools = {
  TOOL_TITLES,
  openTool,
  closeTool,
  executeTool,
  copyToolResult,
  clearTool
};
