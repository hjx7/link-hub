/**
 * LinkHub New Tab - 主入口模块
 */

// 状态
let currentPage = 'search';

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupBookmarkSync();
  render();
});

// 监听浏览器书签变更（同步）
function setupBookmarkSync() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'bookmarkChanged') {
        if (currentPage === 'bookmarks') {
          window.LinkHubBookmarks?.refreshBookmarks();
        }
      }
    });
  }
}

// 设置事件监听
function setupEventListeners() {
  // 图片加载失败处理（事件委托）
  document.addEventListener('error', (e) => {
    if (e.target.classList.contains('favicon-img')) {
      e.target.style.display = 'none';
      const fallback = e.target.nextElementSibling;
      if (fallback) fallback.style.display = 'flex';
    }
  }, true); // 使用捕获阶段确保能监听到图片错误

  // 导航切换
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });
  
  // 搜索输入
  const mainSearch = document.getElementById('mainSearchInput');
  mainSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') window.LinkHubSearch?.performMainSearch();
  });
  
  // 书签筛选
  const filterInput = document.getElementById('bookmarkFilter');
  filterInput.addEventListener('input', window.LinkHubUtils.debounce(
    (e) => window.LinkHubBookmarks?.filterBookmarks(e), 300
  ));
  
  // 书签弹窗点击外部关闭
  document.getElementById('bookmarkModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookmarkModal') window.LinkHubBookmarks?.closeModal();
  });
  
  // 确认弹窗点击外部关闭
  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') window.LinkHubBookmarks?.closeConfirm();
  });
  
  // 书签树点击（事件委托）
  document.getElementById('bookmarkTreePanel')?.addEventListener('click', (e) => {
    // 检查是否点击了展开/收缩按钮
    const toggle = e.target.closest('.tree-folder-toggle');
    if (toggle) {
      e.stopPropagation();
      const folderId = toggle.dataset.id;
      if (folderId) {
        window.LinkHubBookmarks?.toggleFolder(folderId);
      }
      return;
    }
    
    // 检查是否点击了文件夹标题
    const header = e.target.closest('.tree-folder-header');
    if (header) {
      const folderId = header.dataset.id;
      if (folderId) {
        window.LinkHubBookmarks?.selectFolder(folderId);
      }
      return;
    }
  });
  
  // 内容区点击
  document.getElementById('bookmarkContentPanel')?.addEventListener('click', (e) => {
    // 子文件夹选择
    const selectTarget = e.target.closest('[data-action="select-folder"]');
    if (selectTarget) {
      window.LinkHubBookmarks?.selectFolder(selectTarget.dataset.id);
      return;
    }
  });
  
  // 全局事件委托
  document.addEventListener('click', (e) => {
    // 阻止书签卡片内操作按钮的默认行为和冒泡
    const actionBtn = e.target.closest('.action-btn');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const action = e.target.dataset.action;
    if (!action) return;
    
    switch (action) {
      // 搜索
      case 'search':
        window.LinkHubSearch?.performMainSearch();
        break;
      case 'tag':
        window.LinkHubSearch?.searchByTag(e.target.dataset.tag);
        break;
      // 书签 - 增删改查
      case 'open-add':
        window.LinkHubBookmarks?.openAddBookmark();
        break;
      case 'open-add-folder':
        window.LinkHubBookmarks?.openAddFolder();
        break;
      case 'toggle-view':
        window.LinkHubBookmarks?.toggleViewMode();
        break;
      case 'export-bookmarks':
        window.LinkHubBookmarks?.exportBookmarks();
        break;
      case 'import-bookmarks':
        window.LinkHubBookmarks?.importBookmarks();
        break;
      case 'import-merge':
        window.LinkHubBookmarks?.importMerge();
        break;
      case 'import-replace':
        window.LinkHubBookmarks?.importReplace();
        break;
      case 'close-import':
        window.LinkHubBookmarks?.closeImportModal();
        break;
      case 'refresh':
        window.LinkHubBookmarks?.refreshBookmarks();
        break;
      case 'close-modal':
        window.LinkHubBookmarks?.closeModal();
        break;
      case 'save-bookmark':
        window.LinkHubBookmarks?.saveBookmark();
        break;
      case 'save-folder':
        window.LinkHubBookmarks?.saveFolder();
        break;
      case 'edit-bookmark':
        window.LinkHubBookmarks?.editBookmark(e.target.dataset.id);
        break;
      case 'delete-bookmark':
        window.LinkHubBookmarks?.deleteBookmark(e.target.dataset.id);
        break;
      case 'edit-folder':
        window.LinkHubBookmarks?.editFolder(e.target.dataset.id);
        break;
      case 'delete-folder':
        window.LinkHubBookmarks?.deleteFolder(e.target.dataset.id);
        break;
      case 'add-in-folder':
        window.LinkHubBookmarks?.openAddBookmark(e.target.dataset.parent);
        break;
      case 'close-confirm':
        window.LinkHubBookmarks?.closeConfirm();
        break;
      case 'confirm-delete':
        window.LinkHubBookmarks?.confirmDelete();
        break;
      // 工具
      case 'open-tool':
        window.LinkHubTools?.openTool(e.target.closest('[data-type]')?.dataset.type);
        break;
      case 'close-tool':
        window.LinkHubTools?.closeTool();
        break;
      case 'execute-tool':
        window.LinkHubTools?.executeTool();
        break;
      case 'copy-tool':
        window.LinkHubTools?.copyToolResult();
        break;
      case 'clear-tool':
        window.LinkHubTools?.clearTool();
        break;
    }
  });
}

// 切换页面
function switchPage(page) {
  currentPage = page;
  
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  // 更新页面显示
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });
  
  // 渲染对应页面
  render();
}

// 渲染
function render() {
  switch (currentPage) {
    case 'search':
    case 'sites':
      window.LinkHubSites?.renderSites();
      break;
    case 'bookmarks':
      window.LinkHubBookmarks?.renderBookmarks();
      break;
    case 'tools':
      break;
  }
}

// 暴露函数到全局
window.switchPage = switchPage;
window.render = render;
