/**
 * LinkHub New Tab - 主入口模块
 */

// 状态
let currentPage = 'sites';

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载主题
  initTheme();

  // 检查 URL hash 参数（从命令面板跳转）
  const hash = window.location.hash.slice(1);
  if (hash) {
    if (hash.startsWith('tools:')) {
      currentPage = 'tools';
      const tool = hash.split(':')[1];
      setTimeout(() => window.LinkHubTools?.selectTool(tool), 100);
    } else if (['sites', 'bookmarks', 'tools', 'terminal'].includes(hash)) {
      currentPage = hash;
    }
  }

  setupEventListeners();
  setupBookmarkSync();
  render();

  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === currentPage);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${currentPage}`);
  });
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
  
  // 书签筛选
  const filterInput = document.getElementById('bookmarkFilter');
  filterInput.addEventListener('input', window.LinkHubUtils.debounce(
    (e) => window.LinkHubBookmarks?.filterBookmarks(e), 300
  ));
  
  // 书签弹窗 - 不允许点击遮罩关闭
  document.getElementById('bookmarkModal').addEventListener('click', (e) => {
    if (e.target.id === 'bookmarkModal') {
      e.stopPropagation();
    }
  });

  // 服务器弹窗 - 不允许点击遮罩关闭（只允许按钮关闭）
  document.getElementById('serverModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'serverModal') {
      // 点击遮罩层，不做任何操作
      e.stopPropagation();
    }
  });

  // 分组弹窗 - 不允许点击遮罩关闭
  document.getElementById('groupModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'groupModal') {
      e.stopPropagation();
    }
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

  // 书签树右键菜单
  document.getElementById('bookmarkTreePanel')?.addEventListener('contextmenu', (e) => {
    const header = e.target.closest('.tree-folder-header');
    if (header) {
      e.preventDefault();
      const folderId = header.dataset.id;
      if (folderId) {
        window.LinkHubBookmarks?.showContextMenu(e.clientX, e.clientY, folderId);
      }
    }
  });

  // 全局点击时隐藏右键菜单
  document.addEventListener('click', () => {
    window.LinkHubBookmarks?.hideContextMenu();
  });

  // 全局右键点击空白区域时隐藏菜单
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#bookmarkTreePanel')) {
      window.LinkHubBookmarks?.hideContextMenu();
    }
  });

  // 滚动时隐藏右键菜单
  document.getElementById('bookmarkTreePanel')?.addEventListener('scroll', () => {
    window.LinkHubBookmarks?.hideContextMenu();
  });

  // 文件夹拖拽排序
  const treePanel = document.getElementById('bookmarkTreePanel');
  if (treePanel) {
    treePanel.addEventListener('dragstart', (e) => window.LinkHubBookmarks?.handleTreeDragStart(e));
    treePanel.addEventListener('dragover', (e) => window.LinkHubBookmarks?.handleTreeDragOver(e));
    treePanel.addEventListener('dragleave', (e) => window.LinkHubBookmarks?.handleTreeDragLeave(e));
    treePanel.addEventListener('drop', (e) => window.LinkHubBookmarks?.handleTreeDrop(e));
    treePanel.addEventListener('dragend', (e) => window.LinkHubBookmarks?.handleTreeDragEnd(e));
  }

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
    
    // 从最近包含 data-action 的元素获取 action
    const actionTarget = e.target.closest('[data-action]');
    if (!actionTarget) return;
    
    const action = actionTarget.dataset.action;
    if (!action) return;
    
    switch (action) {
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
        window.LinkHubBookmarks?.editBookmark(actionTarget.dataset.id);
        break;
      case 'delete-bookmark':
        window.LinkHubBookmarks?.deleteBookmark(actionTarget.dataset.id);
        break;
      case 'edit-folder':
        window.LinkHubBookmarks?.editFolder(actionTarget.dataset.id);
        break;
      case 'delete-folder':
        window.LinkHubBookmarks?.deleteFolder(actionTarget.dataset.id);
        break;
      case 'add-in-folder':
        window.LinkHubBookmarks?.openAddBookmark(actionTarget.dataset.parent);
        break;
      case 'close-confirm':
        window.LinkHubBookmarks?.closeConfirm();
        break;
      case 'confirm-delete':
        window.LinkHubBookmarks?.confirmDelete();
        break;
      // 工具 Tab 切换
      case 'tool':
        window.LinkHubTools?.selectTool(actionTarget.dataset.tool);
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
      case 'copy-ts-now':
        window.LinkHubTools?.copyCurrentTimestamp();
        break;
      case 'url-encode':
        window.LinkHubTools?.urlEncode();
        break;
      case 'url-decode':
        window.LinkHubTools?.urlDecode();
        break;
      case 'url-swap':
        window.LinkHubTools?.urlSwap();
        break;
      case 'url-clear':
        window.LinkHubTools?.urlClear();
        break;
      case 'base64-encode':
        window.LinkHubTools?.base64Encode();
        break;
      case 'base64-decode':
        window.LinkHubTools?.base64Decode();
        break;
      case 'base64-swap':
        window.LinkHubTools?.base64Swap();
        break;
      case 'base64-clear':
        window.LinkHubTools?.base64Clear();
        break;
      case 'copy-hash':
        window.LinkHubTools?.copyHash(actionTarget.dataset.hash);
        break;
      case 'set-json-mode':
        window.LinkHubTools?.setJsonMode(actionTarget.dataset.mode);
        break;
      // 终端
      case 'add-server':
        window.LinkHubTerminal?.openAddServer();
        break;
      case 'add-group':
        window.LinkHubTerminal?.addGroup();
        break;
      case 'save-group':
        window.LinkHubTerminal?.saveGroup();
        break;
      case 'close-group-modal':
        window.LinkHubTerminal?.closeGroupModal();
        break;
      case 'select-group':
        window.LinkHubTerminal?.selectGroup(actionTarget.dataset.group);
        break;
      case 'sort-servers':
        window.LinkHubTerminal?.sortServers(actionTarget.dataset.field);
        break;
      case 'delete-group':
        e.stopPropagation();
        window.LinkHubTerminal?.deleteGroup(actionTarget.dataset.group);
        break;
      case 'ctx-edit-group':
        window.LinkHubTerminal?.ctxEditGroup();
        break;
      case 'ctx-delete-group':
        window.LinkHubTerminal?.ctxDeleteGroup();
        break;
      case 'edit-server':
        window.LinkHubTerminal?.openEditServer(actionTarget.dataset.id);
        break;
      case 'delete-server':
        window.LinkHubTerminal?.deleteServer(actionTarget.dataset.id);
        break;
      case 'connect-server':
        window.LinkHubTerminal?.connectServer(actionTarget.dataset.id);
        break;
      case 'save-server':
        window.LinkHubTerminal?.saveServer();
        break;
      case 'close-server-modal':
        window.LinkHubTerminal?.closeServerModal();
        break;
      case 'switch-conn':
        window.LinkHubTerminal?.switchTab(actionTarget.dataset.id);
        break;
      case 'close-conn':
        window.LinkHubTerminal?.closeConnection(actionTarget.dataset.id);
        break;
      case 'toggle-sidebar':
        toggleSidebar();
        break;
      case 'refresh-files':
        window.LinkHubTerminal?.refreshFiles(actionTarget.dataset.conn);
        break;
      case 'upload-file':
        window.LinkHubTerminal?.uploadFile(actionTarget.dataset.conn);
        break;
      case 'nav-dir':
        window.LinkHubTerminal?.navDir(actionTarget.dataset.conn, actionTarget.dataset.path);
        break;
      case 'file-page':
        window.LinkHubTerminal?.filePageChange(actionTarget.dataset.conn, actionTarget.dataset.page);
        break;
      case 'ctx-download':
        window.LinkHubTerminal?.downloadFile();
        break;
      case 'ctx-rename':
        window.LinkHubTerminal?.renameFile();
        break;
      case 'open-text-file':
        window.LinkHubTerminal?.openTextFile(actionTarget.dataset.conn, actionTarget.dataset.filepath, actionTarget.dataset.name);
        break;
      case 'switch-file-tab':
        window.LinkHubTerminal?.switchFileTab(actionTarget.dataset.conn, actionTarget.dataset.tabid);
        break;
      case 'close-file-tab':
        e.stopPropagation();
        window.LinkHubTerminal?.closeFileTab(actionTarget.dataset.conn, actionTarget.dataset.tabid);
        break;
      case 'save-file':
        window.LinkHubTerminal?.saveFile(actionTarget.dataset.conn);
        break;
      case 'refresh-file':
        window.LinkHubTerminal?.refreshFile(actionTarget.dataset.conn);
        break;
    }
  });
}

// 切换页面
function switchPage(page) {
  currentPage = page;
  
  // 切换到非终端页面时，恢复侧栏
  if (page !== 'terminal') {
    const sidebar = document.getElementById('mainSidebar');
    const mainContent = document.querySelector('.main-content');
    sidebar.classList.remove('collapsed');
    mainContent.classList.remove('sidebar-collapsed');
  }
  
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
    case 'sites':
      window.LinkHubSites?.renderSites();
      break;
    case 'bookmarks':
      window.LinkHubBookmarks?.renderBookmarks();
      break;
    case 'tools':
      // 工具页面初始化已由 tools.js 处理
      break;
  }
}

// 暴露函数到全局
window.switchPage = switchPage;
window.render = render;

// 侧栏收起/展开
function toggleSidebar() {
  const sidebar = document.getElementById('mainSidebar');
  const mainContent = document.querySelector('.main-content');
  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('sidebar-collapsed');
}

// 主题切换
function initTheme() {
  const saved = localStorage.getItem('linkhub-theme') || 'light';
  applyTheme(saved);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('linkhub-theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  if (icon && text) {
    if (theme === 'dark') {
      icon.textContent = '☀️';
      text.textContent = '浅色模式';
    } else {
      icon.textContent = '🌙';
      text.textContent = '深色模式';
    }
  }
}
