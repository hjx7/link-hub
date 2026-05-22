/**
 * LinkHub New Tab - 快捷命令面板
 * Ctrl+K 唤起，支持快速跳转书签、切换页面、执行操作
 */

let _commandPaletteVisible = false;
let _commandItems = [];
let _filteredItems = [];
let _selectedIndex = 0;

// 命令类型
const CMD_TYPE = {
  PAGE: 'page',
  TOOL: 'tool',
  BOOKMARK: 'bookmark',
  SITE: 'site'
};

// 内置命令
function getBuiltinCommands() {
  return [
    { type: CMD_TYPE.PAGE, icon: '🌐', title: '常用网站', desc: '切换到常用网站页面', action: () => window.switchPage('sites') },
    { type: CMD_TYPE.PAGE, icon: '📁', title: '我的书签', desc: '切换到书签管理页面', action: () => window.switchPage('bookmarks') },
    { type: CMD_TYPE.PAGE, icon: '🛠️', title: '实用工具', desc: '切换到工具页面', action: () => window.switchPage('tools') },
    { type: CMD_TYPE.TOOL, icon: '{}', title: 'JSON 格式化', desc: '打开 JSON 工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('json'); } },
    { type: CMD_TYPE.TOOL, icon: '⏰', title: '时间戳转换', desc: '打开时间戳工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('timestamp'); } },
    { type: CMD_TYPE.TOOL, icon: '🔗', title: 'URL 编解码', desc: '打开 URL 工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('url'); } },
    { type: CMD_TYPE.TOOL, icon: '01', title: 'Base64 编解码', desc: '打开 Base64 工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('base64'); } },
    { type: CMD_TYPE.TOOL, icon: '🎨', title: '颜色转换', desc: '打开颜色工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('color'); } },
    { type: CMD_TYPE.TOOL, icon: '🎲', title: 'UUID 生成', desc: '打开 UUID 工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('uuid'); } },
    { type: CMD_TYPE.TOOL, icon: '📋', title: 'Cron 表达式', desc: '打开 Cron 解析工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('cron'); } },
    { type: CMD_TYPE.TOOL, icon: '.*', title: '正则表达式', desc: '打开正则测试工具', action: () => { window.switchPage('tools'); window.LinkHubTools?.selectTool('regex'); } },
  ];
}

// 获取常用网站命令
function getSiteCommands() {
  const { devSiteCategories } = window.LinkHubData;
  const commands = [];
  for (const cat of devSiteCategories) {
    for (const site of cat.sites) {
      commands.push({
        type: CMD_TYPE.SITE,
        icon: '🌐',
        title: site.name,
        desc: site.url,
        action: () => window.open(site.url, '_blank')
      });
    }
  }
  return commands;
}

// 获取书签命令（从 Chrome 书签树中提取）
function getBookmarkCommands() {
  const commands = [];
  const tree = window.LinkHubBookmarks?._getBookmarkTree?.();
  if (!tree) return commands;

  function collect(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.url) {
        commands.push({
          type: CMD_TYPE.BOOKMARK,
          icon: '📄',
          title: node.title || node.url,
          desc: node.url,
          action: () => window.open(node.url, '_blank')
        });
      }
      if (node.children) {
        collect(node.children);
      }
    }
  }
  collect(tree);
  return commands;
}

// 构建所有命令列表
function buildCommandList() {
  _commandItems = [
    ...getBuiltinCommands(),
    ...getSiteCommands(),
    ...getBookmarkCommands()
  ];
}

// 过滤命令
function filterCommands(query) {
  if (!query) {
    _filteredItems = _commandItems.slice(0, 10);
  } else {
    const lower = query.toLowerCase();
    _filteredItems = _commandItems.filter(item =>
      item.title.toLowerCase().includes(lower) ||
      (item.desc && item.desc.toLowerCase().includes(lower))
    ).slice(0, 10);
  }
  _selectedIndex = 0;
}

// 显示命令面板
async function showCommandPalette() {
  // 确保书签树已加载
  if (!window.LinkHubBookmarks?._getBookmarkTree?.()) {
    await window.LinkHubBookmarks?.loadChromeBookmarkTree?.();
  }

  buildCommandList();
  filterCommands('');
  _commandPaletteVisible = true;

  const overlay = document.getElementById('commandPalette');
  overlay.style.display = 'flex';

  const input = document.getElementById('commandInput');
  input.value = '';
  input.focus();

  renderCommandList();
}

// 隐藏命令面板
function hideCommandPalette() {
  _commandPaletteVisible = false;
  const overlay = document.getElementById('commandPalette');
  overlay.style.display = 'none';
}

// 渲染命令列表
function renderCommandList() {
  const { escapeHtml } = window.LinkHubUtils;
  const container = document.getElementById('commandList');

  if (_filteredItems.length === 0) {
    container.innerHTML = '<div class="command-empty">没有匹配的命令</div>';
    return;
  }

  container.innerHTML = _filteredItems.map((item, idx) => `
    <div class="command-item ${idx === _selectedIndex ? 'selected' : ''}" data-index="${idx}">
      <span class="command-item-icon">${item.icon}</span>
      <div class="command-item-info">
        <span class="command-item-title">${escapeHtml(item.title)}</span>
        ${item.desc ? `<span class="command-item-desc">${escapeHtml(item.desc)}</span>` : ''}
      </div>
      <span class="command-item-type">${getTypeLabel(item.type)}</span>
    </div>
  `).join('');

  // 确保选中项可见
  const selected = container.querySelector('.command-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

// 获取类型标签
function getTypeLabel(type) {
  switch (type) {
    case CMD_TYPE.PAGE: return '页面';
    case CMD_TYPE.TOOL: return '工具';
    case CMD_TYPE.BOOKMARK: return '书签';
    case CMD_TYPE.SITE: return '网站';
    default: return '';
  }
}

// 执行选中的命令
function executeSelected() {
  const item = _filteredItems[_selectedIndex];
  if (item) {
    hideCommandPalette();
    item.action();
  }
}

// 处理输入
function handleCommandInput(e) {
  const query = e.target.value.trim();
  filterCommands(query);
  renderCommandList();
}

// 处理键盘
function handleCommandKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      _selectedIndex = Math.min(_selectedIndex + 1, _filteredItems.length - 1);
      renderCommandList();
      break;
    case 'ArrowUp':
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      renderCommandList();
      break;
    case 'Enter':
      e.preventDefault();
      executeSelected();
      break;
    case 'Escape':
      e.preventDefault();
      hideCommandPalette();
      break;
  }
}

// 处理列表点击
function handleCommandClick(e) {
  const item = e.target.closest('.command-item');
  if (item) {
    _selectedIndex = parseInt(item.dataset.index);
    executeSelected();
  }
}

// 初始化
function initCommandPalette() {
  // 全局快捷键 Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (_commandPaletteVisible) {
        hideCommandPalette();
      } else {
        showCommandPalette();
      }
    }
  });

  // 点击遮罩关闭
  const overlay = document.getElementById('commandPalette');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideCommandPalette();
    }
  });

  // 输入事件
  const input = document.getElementById('commandInput');
  input.addEventListener('input', handleCommandInput);
  input.addEventListener('keydown', handleCommandKeydown);

  // 列表点击
  const list = document.getElementById('commandList');
  list.addEventListener('click', handleCommandClick);
}

// DOM 加载后初始化
document.addEventListener('DOMContentLoaded', initCommandPalette);

// 暴露到全局
window.LinkHubCommand = {
  show: showCommandPalette,
  hide: hideCommandPalette
};
