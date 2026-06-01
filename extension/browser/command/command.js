/**
 * LinkHub - 全局命令面板（iframe 内运行）
 * 通过 chrome.bookmarks API 获取书签，通过 postMessage 与父页面通信
 */

let _items = [];
let _filtered = [];
let _selectedIndex = 0;

// 内置命令（页面切换、工具）
const BUILTIN = [
  { icon: '🌐', title: '常用网站', desc: '打开 LinkHub 常用网站', type: '页面', actionType: 'page', page: 'sites' },
  { icon: '📁', title: '我的书签', desc: '打开 LinkHub 书签管理', type: '页面', actionType: 'page', page: 'bookmarks' },
  { icon: '🛠️', title: '实用工具', desc: '打开 LinkHub 工具页面', type: '页面', actionType: 'page', page: 'tools' },
  { icon: '{}', title: 'JSON 格式化', desc: '打开 JSON 工具', type: '工具', actionType: 'page', page: 'tools:json' },
  { icon: '⏰', title: '时间戳转换', desc: '打开时间戳工具', type: '工具', actionType: 'page', page: 'tools:timestamp' },
  { icon: '📋', title: 'Cron 表达式', desc: '打开 Cron 解析工具', type: '工具', actionType: 'page', page: 'tools:cron' },
  { icon: '.*', title: '正则表达式', desc: '打开正则测试工具', type: '工具', actionType: 'page', page: 'tools:regex' },
  { icon: '🔗', title: 'URL 编解码', desc: '打开 URL 工具', type: '工具', actionType: 'page', page: 'tools:url' },
  { icon: '01', title: 'Base64 编解码', desc: '打开 Base64 工具', type: '工具', actionType: 'page', page: 'tools:base64' },
  { icon: '🔑', title: 'JWT 解析', desc: '打开 JWT 解析工具', type: '工具', actionType: 'page', page: 'tools:jwt' },
  { icon: '#', title: 'MD5/SHA 哈希', desc: '打开哈希计算工具', type: '工具', actionType: 'page', page: 'tools:hash' },
  { icon: '⇄', title: 'Diff 对比', desc: '打开文本对比工具', type: '工具', actionType: 'page', page: 'tools:diff' },
];

// 加载书签
async function loadBookmarks() {
  try {
    const tree = await chrome.bookmarks.getTree();
    const bookmarks = [];
    function collect(nodes) {
      if (!nodes) return;
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push({
            icon: '📄',
            title: node.title || node.url,
            desc: node.url,
            type: '书签',
            actionType: 'url',
            url: node.url
          });
        }
        if (node.children) collect(node.children);
      }
    }
    collect(tree);
    return bookmarks;
  } catch (e) {
    return [];
  }
}

// 获取服务器列表
function getServers() {
  try {
    const servers = JSON.parse(localStorage.getItem('linkhub-servers') || '[]');
    return servers.map(s => ({
      icon: '💻',
      title: s.name || s.host || '',
      desc: (s.username || '') + '@' + (s.host || s.wsUrl || ''),
      type: '服务器',
      actionType: 'page',
      page: 'terminal'
    }));
  } catch (e) {
    return [];
  }
}

// 构建命令列表
async function buildItems() {
  const bookmarks = await loadBookmarks();
  const servers = getServers();
  _items = [...BUILTIN, ...servers, ...bookmarks];
}

// 过滤
function filter(query) {
  if (!query) {
    _filtered = _items.slice(0, 10);
  } else {
    const lower = query.toLowerCase();
    _filtered = _items.filter(item =>
      item.title.toLowerCase().includes(lower) ||
      (item.desc && item.desc.toLowerCase().includes(lower))
    ).slice(0, 10);
  }
  _selectedIndex = 0;
}

// 渲染列表
function render() {
  const list = document.getElementById('list');

  if (_filtered.length === 0) {
    list.innerHTML = '<div class="empty">没有匹配的命令</div>';
    return;
  }

  list.innerHTML = _filtered.map((item, idx) => `
    <div class="item ${idx === _selectedIndex ? 'selected' : ''}" data-index="${idx}">
      <span class="item-icon">${item.icon}</span>
      <div class="item-info">
        <span class="item-title">${escapeHtml(item.title)}</span>
        ${item.desc ? `<span class="item-desc">${escapeHtml(item.desc)}</span>` : ''}
      </div>
      <span class="item-type">${item.type}</span>
    </div>
  `).join('');

  const selected = list.querySelector('.item.selected');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

// 执行命令
function execute() {
  const item = _filtered[_selectedIndex];
  if (!item) return;

  if (item.actionType === 'url') {
    window.parent.postMessage({ type: 'linkhub-open-url', url: item.url }, '*');
  } else if (item.actionType === 'page') {
    window.parent.postMessage({ type: 'linkhub-open-tab', page: item.page }, '*');
  }
}

// 关闭面板
function close() {
  window.parent.postMessage({ type: 'linkhub-close' }, '*');
}

// HTML 转义
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 初始化
async function init() {
  await buildItems();
  filter('');
  render();

  const input = document.getElementById('input');
  input.focus();

  // 输入
  input.addEventListener('input', () => {
    filter(input.value.trim());
    render();
  });

  // 键盘
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        _selectedIndex = Math.min(_selectedIndex + 1, _filtered.length - 1);
        render();
        break;
      case 'ArrowUp':
        e.preventDefault();
        _selectedIndex = Math.max(_selectedIndex - 1, 0);
        render();
        break;
      case 'Enter':
        e.preventDefault();
        execute();
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  });

  // 点击列表项
  document.getElementById('list').addEventListener('click', (e) => {
    const item = e.target.closest('.item');
    if (item) {
      _selectedIndex = parseInt(item.dataset.index);
      execute();
    }
  });

  // 点击遮罩关闭
  document.getElementById('overlay').addEventListener('click', (e) => {
    if (e.target.id === 'overlay') {
      close();
    }
  });

  // 监听父页面消息（获取焦点）
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'linkhub-focus') {
      input.focus();
    }
  });
}

init();
