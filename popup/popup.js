/**
 * LinkHub Extension - Popup Script
 * 处理 UI 交互和与 background.js 的通信
 */

// 状态
let currentTab = 'bookmarks';
let bookmarks = [];
let categories = [];
let quickLinks = [];
let currentTool = null;

// DOM 元素
const searchInput = document.getElementById('searchInput');
const quickLinksEl = document.getElementById('quickLinks');
const bookmarkListEl = document.getElementById('bookmarkList');
const categoryListEl = document.getElementById('categoryList');
const addModal = document.getElementById('addModal');
const toolPanel = document.getElementById('toolPanel');

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  render();
});

// 加载数据
async function loadData() {
  try {
    const [bmResult, catResult, qlResult] = await Promise.all([
      sendMessage({ action: 'getBookmarks' }),
      sendMessage({ action: 'getCategories' }),
      sendMessage({ action: 'getQuickLinks' })
    ]);
    
    bookmarks = bmResult.data || [];
    categories = catResult.data || [];
    quickLinks = qlResult.data || [];
  } catch (err) {
    console.error('加载数据失败:', err);
  }
}

// 发送消息到 background
function sendMessage(request) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(request, resolve);
  });
}

// 设置事件监听
function setupEventListeners() {
  // 标签切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // 搜索
  searchInput.addEventListener('input', debounce(handleSearch, 300));
  
  // 工具按钮
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => openTool(btn.dataset.tool));
  });
  
  // 点击外部关闭模态框
  addModal.addEventListener('click', (e) => {
    if (e.target === addModal) closeAddBookmark();
  });
}

// 切换标签
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`${tab}-content`).classList.add('active');
  
  render();
}

// 搜索处理
async function handleSearch(e) {
  const query = e.target.value.trim();
  
  if (!query) {
    render();
    return;
  }
  
  const result = await sendMessage({ action: 'searchBookmarks', data: query });
  const filtered = result.data || [];
  renderBookmarkList(filtered);
}

// 渲染
function render() {
  renderQuickLinks();
  renderBookmarkList(bookmarks);
  renderCategoryList();
  updateCategorySelect();
}

// 渲染快捷链接
function renderQuickLinks() {
  quickLinksEl.innerHTML = quickLinks.map(link => `
    <a href="${escapeHtml(link.url)}" class="quick-link" target="_blank">
      ${link.favicon 
        ? `<img src="${escapeHtml(link.favicon)}" class="quick-link-icon" onerror="this.style.display='none'">` 
        : getFaviconPlaceholder(link.name)}
      <span>${escapeHtml(link.name)}</span>
    </a>
  `).join('');
}

// 渲染书签列表
function renderBookmarkList(list) {
  if (list.length === 0) {
    bookmarkListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div>暂无书签</div>
        <div style="font-size:12px;margin-top:4px;">点击下方 + 按钮添加</div>
      </div>
    `;
    return;
  }
  
  bookmarkListEl.innerHTML = list.map(bm => `
    <div class="bookmark-item" data-id="${bm.id}">
      <div class="bookmark-favicon">
        ${bm.favicon 
          ? `<img src="${escapeHtml(bm.favicon)}" onerror="this.parentElement.textContent='${escapeHtml(bm.title[0])}'">` 
          : escapeHtml(bm.title[0])}
      </div>
      <div class="bookmark-info" onclick="openBookmark('${escapeHtml(bm.url)}')">
        <div class="bookmark-title">${escapeHtml(bm.title)}</div>
        <div class="bookmark-url">${escapeHtml(bm.url)}</div>
      </div>
      <span class="bookmark-category">${escapeHtml(bm.category)}</span>
      <div class="bookmark-actions">
        <button class="bookmark-action" onclick="event.stopPropagation(); editBookmark('${bm.id}')" title="编辑">✏️</button>
        <button class="bookmark-action delete" onclick="event.stopPropagation(); deleteBookmark('${bm.id}')" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');
}

// 渲染分类列表
function renderCategoryList() {
  // 统计每个分类的书签数量
  const counts = {};
  bookmarks.forEach(bm => {
    counts[bm.category] = (counts[bm.category] || 0) + 1;
  });
  
  // 包含书签的分类排在前面
  const sortedCategories = [...categories].sort((a, b) => {
    const aCount = counts[a.id] || 0;
    const bCount = counts[b.id] || 0;
    return bCount - aCount;
  });
  
  categoryListEl.innerHTML = sortedCategories.map(cat => `
    <div class="category-item" onclick="filterByCategory('${cat.id}')">
      <span class="category-icon">${cat.icon}</span>
      <span class="category-name">${escapeHtml(cat.name)}</span>
      <span class="category-count">${counts[cat.id] || 0} 个书签</span>
    </div>
  `).join('');
}

// 更新分类选择器
function updateCategorySelect() {
  const select = document.getElementById('bmCategory');
  select.innerHTML = categories.map(cat => 
    `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
  ).join('');
}

// 打开书签
function openBookmark(url) {
  chrome.tabs.create({ url });
  window.close();
}

// 打开添加书签弹窗
function openAddBookmark() {
  // 如果当前页面有选中内容，获取 URL
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];
    
    document.getElementById('bmTitle').value = currentTab.title || '';
    document.getElementById('bmUrl').value = currentTab.url || '';
    document.getElementById('bmCategory').value = 'default';
    
    addModal.style.display = 'flex';
  });
}

// 关闭添加书签弹窗
function closeAddBookmark() {
  addModal.style.display = 'none';
  document.getElementById('bmTitle').value = '';
  document.getElementById('bmUrl').value = '';
}

// 保存书签
async function saveBookmark() {
  const title = document.getElementById('bmTitle').value.trim();
  const url = document.getElementById('bmUrl').value.trim();
  const category = document.getElementById('bmCategory').value;
  
  if (!title || !url) {
    alert('请填写标题和网址');
    return;
  }
  
  if (!isValidUrl(url)) {
    alert('请输入有效的网址');
    return;
  }
  
  const result = await sendMessage({
    action: 'addBookmark',
    data: { title, url, category }
  });
  
  if (result.success) {
    bookmarks.push(result.data);
    closeAddBookmark();
    render();
  }
}

// 编辑书签
async function editBookmark(id) {
  const bookmark = bookmarks.find(b => b.id === id);
  if (!bookmark) return;
  
  document.getElementById('bmTitle').value = bookmark.title;
  document.getElementById('bmUrl').value = bookmark.url;
  document.getElementById('bmCategory').value = bookmark.category || 'default';
  
  // 修改保存按钮的行为
  const saveBtn = addModal.querySelector('.btn-primary');
  saveBtn.onclick = async () => {
    const title = document.getElementById('bmTitle').value.trim();
    const url = document.getElementById('bmUrl').value.trim();
    const category = document.getElementById('bmCategory').value;
    
    await sendMessage({
      action: 'updateBookmark',
      data: { id, title, url, category }
    });
    
    closeAddBookmark();
    await loadData();
    render();
    
    // 恢复保存按钮
    saveBtn.onclick = saveBookmark;
  };
  
  addModal.style.display = 'flex';
}

// 删除书签
async function deleteBookmark(id) {
  if (!confirm('确定删除这个书签？')) return;
  
  const result = await sendMessage({ action: 'deleteBookmark', data: id });
  if (result.success) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    render();
  }
}

// 按分类筛选
function filterByCategory(categoryId) {
  const filtered = bookmarks.filter(b => b.category === categoryId);
  renderBookmarkList(filtered);
  switchTab('bookmarks');
}

// 导入书签
async function importBookmarks() {
  if (!confirm('从 Chrome 原生书签导入？\n已存在的书签不会被覆盖。')) return;
  
  const count = await sendMessage({ action: 'importFromChrome' });
  await loadData();
  render();
  alert(`成功导入 ${count.data} 个书签`);
}

// 导出书签
async function exportBookmarks() {
  if (!confirm('导出到 Chrome 原生书签？\n将在书签栏创建 LinkHub 文件夹。')) return;
  
  const count = await sendMessage({ action: 'exportToChrome' });
  alert(`成功导出 ${count.data} 个书签`);
}

// 在新标签页打开
function openInNewTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab/index.html') });
  window.close();
}

// ============ 工具函数 ============

// 打开工具
function openTool(tool) {
  currentTool = tool;
  const titles = {
    json: 'JSON 格式化',
    timestamp: '时间戳转换',
    url: 'URL 编解码',
    base64: 'Base64 编解码'
  };
  
  document.getElementById('toolTitle').textContent = titles[tool];
  document.getElementById('toolInput').value = '';
  document.getElementById('toolResult').textContent = '';
  toolPanel.style.display = 'block';
}

// 关闭工具
function closeTool() {
  toolPanel.style.display = 'none';
  currentTool = null;
}

// 执行工具
function executeTool() {
  const input = document.getElementById('toolInput').value;
  const resultEl = document.getElementById('toolResult');
  
  try {
    let result;
    switch (currentTool) {
      case 'json':
        const parsed = JSON.parse(input);
        result = JSON.stringify(parsed, null, 2);
        break;
      case 'timestamp':
        const ts = parseInt(input);
        if (isNaN(ts)) {
          const d = new Date(input);
          if (isNaN(d.getTime())) {
            result = '无效输入';
          } else {
            result = `毫秒: ${d.getTime()}\n秒: ${Math.floor(d.getTime() / 1000)}\n日期: ${d.toLocaleString()}`;
          }
        } else {
          const d = new Date(ts > 9999999999 ? ts : ts * 1000);
          result = `日期: ${d.toLocaleString()}\nISO: ${d.toISOString()}`;
        }
        break;
      case 'url':
        result = encodeURIComponent(input);
        break;
      case 'base64':
        result = btoa(unescape(encodeURIComponent(input)));
        break;
    }
    resultEl.textContent = result;
  } catch (err) {
    resultEl.textContent = '错误: ' + err.message;
  }
}

// 复制结果
function copyResult() {
  const result = document.getElementById('toolResult').textContent;
  navigator.clipboard.writeText(result);
}

// 清空工具
function clearTool() {
  document.getElementById('toolInput').value = '';
  document.getElementById('toolResult').textContent = '';
}

// ============ 辅助函数 ============

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getFaviconPlaceholder(text) {
  return text[0]?.toUpperCase() || '?';
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 暴露函数到全局
window.openBookmark = openBookmark;
window.editBookmark = editBookmark;
window.deleteBookmark = deleteBookmark;
window.openAddBookmark = openAddBookmark;
window.closeAddBookmark = closeAddBookmark;
window.saveBookmark = saveBookmark;
window.filterByCategory = filterByCategory;
window.importBookmarks = importBookmarks;
window.exportBookmarks = exportBookmarks;
window.openInNewTab = openInNewTab;
window.openTool = openTool;
window.closeTool = closeTool;
window.executeTool = executeTool;
window.copyResult = copyResult;
window.clearTool = clearTool;
