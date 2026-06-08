/**
 * LinkHub New Tab - 主入口模块 (Vite + TypeScript)
 */

import { debounce } from './utils';
import { renderSites } from './sites';
import { initCommandPalette } from './command';
import {
  initTools, selectTool, setJsonMode, executeTool, copyToolResult, clearTool,
  copyCurrentTimestamp, urlEncode, urlDecode, urlSwap, urlClear,
  base64Encode, base64Decode, base64Swap, base64Clear, copyHash
} from './tools/index';
import {
  initBookmarks, renderBookmarks, filterBookmarks, refreshBookmarks,
  openAddBookmark, openAddFolder, saveBookmark, saveFolder,
  deleteBookmark, deleteFolder, editBookmark, editFolder,
  selectFolder, toggleFolder, confirmDelete, closeModal, closeConfirm,
  exportBookmarks, importBookmarks, importMerge, importReplace, closeImportModal,
  showContextMenu, hideContextMenu,
  handleTreeDragStart, handleTreeDragOver, handleTreeDragLeave, handleTreeDrop, handleTreeDragEnd
} from './bookmarks';
import {
  initTerminal, connectServer, openAddServer, openEditServer, saveServer,
  deleteServer, closeServerModal, switchAuthType, switchTab, closeConnection,
  refreshFiles, navDir, uploadFile, filePageChange, downloadFile, renameFile,
  addGroup, deleteGroup, selectGroup, sortServers, saveGroup, closeGroupModal,
  ctxEditGroup, ctxDeleteGroup, openTextFile, closeFileTab, switchFileTab,
  saveFile, refreshFile, toggleFilePanel,
  openBatchExec, closeBatchExec, runBatchExec, closeBatchCell
} from './terminal';
import {
  initTodo, renderTodo, addTodo, toggleTodo, deleteTodo,
  openEditTodo, saveEditTodo, closeEditTodoModal,
  addTodoGroup, saveTodoGroup, closeTodoGroupModal,
  deleteTodoGroup, selectTodoGroup
} from './todo';

const VALID_PAGES = ['sites', 'bookmarks', 'tools', 'todo', 'terminal'] as const;
type PageName = typeof VALID_PAGES[number];

let currentPage: PageName = 'sites';

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // 检查 URL hash 参数
  const hash = window.location.hash.slice(1);
  if (hash) {
    if (hash.startsWith('tools:')) {
      currentPage = 'tools';
    } else if (['sites', 'bookmarks', 'tools', 'todo', 'terminal'].includes(hash)) {
      currentPage = hash as PageName;
    }
  }

  setupEventListeners();
  initCommandPalette(switchPage);
  render();
  updateNavState();
});

// ===== 页面切换 =====

function switchPage(page: string): void {
  if (!VALID_PAGES.includes(page as PageName)) return;
  currentPage = page as PageName;

  if (page !== 'terminal') {
    document.getElementById('mainSidebar')?.classList.remove('collapsed');
    document.querySelector('.main-content')?.classList.remove('sidebar-collapsed');
  }

  updateNavState();
  render();
}

function updateNavState(): void {
  document.querySelectorAll('.nav-item').forEach(item => {
    const el = item as HTMLElement;
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
  document.querySelectorAll('.page').forEach(p => {
    (p as HTMLElement).classList.toggle('active', p.id === `page-${currentPage}`);
  });
}

function render(): void {
  switch (currentPage) {
    case 'sites':
      renderSites();
      break;
    case 'todo':
      initTodo();
      break;
    case 'bookmarks':
      initBookmarks();
      renderBookmarks();
      break;
    case 'tools':
      initTools();
      break;
    case 'terminal':
      initTerminal();
      break;
  }
}

// ===== 事件委托 =====

function setupEventListeners(): void {
  // 导航切换
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = (item as HTMLElement).dataset.page;
      if (page) switchPage(page);
    });
  });

  // 弹窗遮罩阻止关闭
  const modalIds = ['todoGroupModal', 'todoEditModal'];
  modalIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === id) e.stopPropagation();
    });
  });

  // 全局事件委托
  document.addEventListener('click', handleGlobalClick);
}

function handleGlobalClick(e: MouseEvent): void {
  const actionTarget = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  if (!actionTarget) return;

  const action = actionTarget.dataset.action;
  if (!action) return;

  switch (action) {
    // 工具
    case 'tool':
      selectTool(actionTarget.dataset.tool!);
      break;
    case 'execute-tool':
      executeTool();
      break;
    case 'copy-tool':
      copyToolResult();
      break;
    case 'clear-tool':
      clearTool();
      break;
    case 'copy-ts-now':
      copyCurrentTimestamp();
      break;
    case 'set-json-mode':
      setJsonMode(actionTarget.dataset.mode!);
      break;
    case 'url-encode':
      urlEncode();
      break;
    case 'url-decode':
      urlDecode();
      break;
    case 'url-swap':
      urlSwap();
      break;
    case 'url-clear':
      urlClear();
      break;
    case 'base64-encode':
      base64Encode();
      break;
    case 'base64-decode':
      base64Decode();
      break;
    case 'base64-swap':
      base64Swap();
      break;
    case 'base64-clear':
      base64Clear();
      break;
    case 'copy-hash':
      copyHash(actionTarget.dataset.hash!);
      break;
    // 书签
    case 'open-add':
      openAddBookmark();
      break;
    case 'open-add-folder':
      openAddFolder();
      break;
    case 'export-bookmarks':
      exportBookmarks();
      break;
    case 'import-bookmarks':
      importBookmarks();
      break;
    case 'import-merge':
      importMerge();
      break;
    case 'import-replace':
      importReplace();
      break;
    case 'close-import':
      closeImportModal();
      break;
    case 'refresh':
      refreshBookmarks();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'save-bookmark':
      saveBookmark();
      break;
    case 'save-folder':
      saveFolder();
      break;
    case 'edit-bookmark':
      editBookmark(actionTarget.dataset.id!);
      break;
    case 'delete-bookmark':
      deleteBookmark(actionTarget.dataset.id!);
      break;
    case 'edit-folder':
      editFolder(actionTarget.dataset.id!);
      break;
    case 'delete-folder':
      deleteFolder(actionTarget.dataset.id!);
      break;
    case 'add-in-folder':
      openAddBookmark(actionTarget.dataset.parent as any);
      break;
    case 'close-confirm':
      closeConfirm();
      break;
    case 'confirm-delete':
      confirmDelete();
      break;
    case 'select-folder':
      selectFolder(actionTarget.dataset.id!);
      break;
    // 终端
    case 'add-server':
      openAddServer();
      break;
    case 'add-group':
      addGroup();
      break;
    case 'save-group':
      saveGroup();
      break;
    case 'close-group-modal':
      closeGroupModal();
      break;
    case 'select-group':
      selectGroup(actionTarget.dataset.group!);
      break;
    case 'sort-servers':
      sortServers(actionTarget.dataset.field!);
      break;
    case 'delete-group':
      e.stopPropagation();
      deleteGroup(actionTarget.dataset.group!);
      break;
    case 'ctx-edit-group':
      ctxEditGroup();
      break;
    case 'ctx-delete-group':
      ctxDeleteGroup();
      break;
    case 'edit-server':
      openEditServer(actionTarget.dataset.id!);
      break;
    case 'delete-server':
      deleteServer(actionTarget.dataset.id!);
      break;
    case 'connect-server':
      connectServer(actionTarget.dataset.id!);
      break;
    case 'save-server':
      saveServer();
      break;
    case 'switch-auth-type':
      switchAuthType(actionTarget.dataset.auth!);
      break;
    case 'close-server-modal':
      closeServerModal();
      break;
    case 'switch-conn':
      switchTab(actionTarget.dataset.id!);
      break;
    case 'close-conn':
      closeConnection(actionTarget.dataset.id!);
      break;
    case 'toggle-sidebar':
      toggleSidebar();
      break;
    case 'refresh-files':
      refreshFiles(actionTarget.dataset.conn!);
      break;
    case 'upload-file':
      uploadFile(actionTarget.dataset.conn!);
      break;
    case 'nav-dir':
      navDir(actionTarget.dataset.conn!, actionTarget.dataset.path!);
      break;
    case 'file-page':
      filePageChange(actionTarget.dataset.conn!, actionTarget.dataset.page!);
      break;
    case 'ctx-download':
      downloadFile();
      break;
    case 'ctx-rename':
      renameFile();
      break;
    case 'open-text-file':
      openTextFile(actionTarget.dataset.conn!, actionTarget.dataset.filepath!, actionTarget.dataset.name!);
      break;
    case 'switch-file-tab':
      switchFileTab(actionTarget.dataset.conn!, actionTarget.dataset.tabid!);
      break;
    case 'close-file-tab':
      e.stopPropagation();
      closeFileTab(actionTarget.dataset.conn!, actionTarget.dataset.tabid!);
      break;
    case 'save-file':
      saveFile(actionTarget.dataset.conn!);
      break;
    case 'refresh-file':
      refreshFile(actionTarget.dataset.conn!);
      break;
    case 'toggle-file-panel':
      toggleFilePanel(actionTarget.dataset.conn!);
      break;
    case 'batch-exec':
      openBatchExec();
      break;
    case 'close-batch-exec':
      closeBatchExec();
      break;
    case 'run-batch-exec':
      runBatchExec();
      break;
    case 'batch-cell-close':
      closeBatchCell(actionTarget.dataset.batch!, actionTarget.dataset.server!);
      break;
    // 待办
    case 'toggle-todo':
      toggleTodo(actionTarget.dataset.id!);
      break;
    case 'edit-todo':
      openEditTodo(actionTarget.dataset.id!);
      break;
    case 'delete-todo':
      deleteTodo(actionTarget.dataset.id!);
      break;
    case 'select-todo-group':
      selectTodoGroup(actionTarget.dataset.group!);
      break;
    case 'add-todo-group':
      addTodoGroup();
      break;
    case 'delete-todo-group':
      e.stopPropagation();
      deleteTodoGroup(actionTarget.dataset.group!);
      break;
    case 'save-todo-group':
      saveTodoGroup();
      break;
    case 'close-todo-group-modal':
      closeTodoGroupModal();
      break;
    case 'save-todo-edit':
      saveEditTodo();
      break;
    case 'close-todo-edit-modal':
      closeEditTodoModal();
      break;
  }
}

// ===== 主题 =====

function initTheme(): void {
  const saved = localStorage.getItem('linkhub-theme') || 'light';
  applyTheme(saved);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('linkhub-theme', next);
  });
}

function applyTheme(theme: string): void {
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

// 暴露给全局
(window as unknown as Record<string, unknown>).switchPage = switchPage;

// 侧栏切换
function toggleSidebar(): void {
  document.getElementById('mainSidebar')?.classList.toggle('collapsed');
  document.querySelector('.main-content')?.classList.toggle('sidebar-collapsed');
}
