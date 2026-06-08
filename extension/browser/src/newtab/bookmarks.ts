/**
 * LinkHub New Tab - 书签模块
 * 直接读取 Chrome 原生书签树进行可视化展示
 * 支持增删改查及浏览器书签同步
 */
// @ts-nocheck

import { escapeHtml, getDomain, sendMessage, isValidUrl } from './utils';

// 状态
let _chromeBookmarkTree = null;
let _currentFilter = '';
let _pendingDeleteId = null;
let _pendingDeleteType = null;
let _selectedFolderId = null; // 首次加载时自动选中第一个文件夹
let _expandedFolders = new Set(); // 跟踪展开的文件夹
let _initialExpandDone = false; // 标记初始展开是否完成

// 收集所有书签 URL
function collectAllUrls(nodes, urls = []) {
  if (!nodes) return urls;
  for (const node of nodes) {
    if (node.url) {
      urls.push(node.url);
    }
    if (node.children) {
      collectAllUrls(node.children, urls);
    }
  }
  return urls;
}

// 图标缓存
const _iconCache = new Map();

// 获取书签图标（立即返回占位符，后台异步加载真实图标）
function getBookmarkIcon(url, title) {
  const fallback = escapeHtml(title[0] || '🔗');
  const cacheKey = url;
  
  // 检查缓存
  if (_iconCache.has(cacheKey)) {
    const cached = _iconCache.get(cacheKey);
    if (cached === 'loading') {
      // 正在加载中，返回占位符
      return `<span class="favicon-loading">${fallback}</span>`;
    } else if (cached) {
      return `<img src="${cached}" class="favicon-img" data-fallback-letter="${fallback}">`;
    }
  }
  
  // 标记为加载中
  _iconCache.set(cacheKey, 'loading');
  
  // 立即返回占位符
  const placeholder = `<span class="favicon-loading" data-url="${escapeHtml(url)}">${fallback}</span>`;
  
  // 后台异步获取真实图标
  fetchFaviconAsync(url, cacheKey);
  
  return placeholder;
}

// 后台异步获取图标
async function fetchFaviconAsync(url, cacheKey) {
  try {
      const result = await sendMessage({ action: 'fetchBestFavicon', data: { url } });
    if (result.success && result.data) {
      _iconCache.set(cacheKey, result.data);
      updateFaviconInDOM(url, result.data);
    } else {
      _iconCache.set(cacheKey, null); // 标记为加载失败
    }
  } catch (e) {
    _iconCache.set(cacheKey, null);
  }
}

// 更新 DOM 中的图标
function updateFaviconInDOM(url, iconUrl) {
  const iconElements = document.querySelectorAll(`.favicon-loading[data-url="${url}"]`);
  iconElements.forEach(el => {
    const letter = el.textContent || '🔗';
    el.outerHTML = `<img src="${iconUrl}" class="favicon-img" data-fallback-letter="${escapeHtml(letter)}">`;
  });
}

// 加载 Chrome 书签树
async function loadChromeBookmarkTree() {
  try {
    const result = await sendMessage({ action: 'getBookmarkTree' });
    if (result.success) {
      _chromeBookmarkTree = result.data;
    }
  } catch (err) {
    console.error('加载书签树失败:', err);
  }
}

// 递归渲染书签树
async function renderBookmarkTreeNode(node, depth = 0) {
  
  // 如果是书签（有效 URL）
  if (node.url) {
    const icon = getBookmarkIcon(node.url, node.title);
    return `
      <div class="bookmark-item">
        <a href="${escapeHtml(node.url)}" target="_blank" title="${escapeHtml(node.title)}">
          <div class="bookmark-icon">
            ${icon}
          </div>
          <span class="bookmark-name">${escapeHtml(node.title)}</span>
          <span class="bookmark-domain">${getDomain(node.url)}</span>
        </a>
        <div class="item-actions">
          <button class="action-btn edit-btn" data-action="edit-bookmark" data-id="${node.id}" title="编辑">✏️</button>
          <button class="action-btn delete-btn" data-action="delete-bookmark" data-id="${node.id}" data-type="bookmark" title="删除">🗑️</button>
        </div>
      </div>
    `;
  }
  
  // 如果是文件夹
  if (node.children && node.children.length > 0) {
    // 分离书签和子文件夹
    const bookmarks = node.children.filter(child => child.url);
    const subFolders = node.children.filter(child => child.children && child.children.length > 0);
    
    // 收集子节点内容（先书签再文件夹）
    let childrenHtml = '';
    let hasVisibleContent = false;
    
    for (const child of bookmarks) {
      const childHtml = await renderBookmarkTreeNode(child, depth + 1);
      if (childHtml) {
        childrenHtml += childHtml;
        hasVisibleContent = true;
      }
    }
    
    for (const child of subFolders) {
      const childHtml = await renderBookmarkTreeNode(child, depth + 1);
      if (childHtml) {
        childrenHtml += childHtml;
        hasVisibleContent = true;
      }
    }
    
    // 如果筛选模式下没有匹配内容，跳过此文件夹
    if (_currentFilter && !hasVisibleContent) {
      return '';
    }
    
    // depth === 0 且 id === '0' 是书签树根节点，直接渲染其子节点（不作为文件夹显示）
    if (depth === 0 && node.id === '0') {
      return childrenHtml;
    }
    
    // 书签栏根节点的直接子节点（depth=1）作为顶级文件夹显示
    // 包括：书签栏(id='1')、其它书签(id='2')、用户创建的顶级文件夹
    const folderIcon = depth === 1 ? '📚' : (depth === 2 ? '📂' : '📁');
    const count = countBookmarks(node);
    // 系统文件夹(id='0','1','2')不显示删除按钮
    const showDeleteBtn = !['0', '1', '2'].includes(node.id);
    
    // 系统文件夹（书签栏和其他书签）使用分类样式展示
    if (['1', '2'].includes(node.id)) {
      return await renderSystemFolderAsCategory(node, depth);
    }
    
    // 用户自定义文件夹默认不展开
    const isExpanded = !_currentFilter;
    
    return `
      <div class="bookmark-folder depth-${depth}" data-id="${node.id}">
        <div class="folder-header" data-action="toggle">
          <span class="folder-icon">${folderIcon}</span>
          <span class="folder-name">${escapeHtml(node.title)}</span>
          <span class="folder-count">(${count} 个)</span>
          <span class="folder-toggle${isExpanded ? ' expanded' : ''}">▶</span>
          <div class="folder-actions">
            <button class="action-btn" data-action="add-in-folder" data-parent="${node.id}" title="在此文件夹添加">➕</button>
            <button class="action-btn edit-btn" data-action="edit-folder" data-id="${node.id}" title="编辑文件夹">✏️</button>
            ${showDeleteBtn ? `<button class="action-btn delete-btn" data-action="delete-folder" data-id="${node.id}" title="删除文件夹">🗑️</button>` : ''}
          </div>
        </div>
        <div class="folder-content${_currentFilter || !isExpanded ? ' collapsed' : ''}">
          ${childrenHtml}
        </div>
      </div>
    `;
  }
  
  return '';
}

// 渲染系统文件夹（书签栏和其他书签）使用分类样式
async function renderSystemFolderAsCategory(node, depth) {
  
  // 分离书签和子文件夹
  const bookmarks = [];
  const subFolders = [];
  
  if (node.children) {
    node.children.forEach(child => {
      if (child.url) {
        bookmarks.push(child);
      } else if (child.children && child.children.length > 0) {
        subFolders.push(child);
      }
    });
  }
  
  // 渲染书签 - 使用列表样式，带操作按钮（图标会异步加载后更新）
  let bookmarksHtml = '';
  if (bookmarks.length > 0) {
    for (const bookmark of bookmarks) {
      const icon = getBookmarkIcon(bookmark.url, bookmark.title);
      bookmarksHtml += `
        <a href="${escapeHtml(bookmark.url)}" class="site-list-item" target="_blank" title="${escapeHtml(bookmark.title)}">
          <div class="site-icon">
            ${icon}
          </div>
          <div class="site-info">
            <span class="site-name">${escapeHtml(bookmark.title)}</span>
            <span class="site-domain">${getDomain(bookmark.url)}</span>
          </div>
          <div class="bookmark-card-actions">
            <button class="action-btn edit-btn" data-action="edit-bookmark" data-id="${bookmark.id}" title="编辑">✏️</button>
            <button class="action-btn delete-btn" data-action="delete-bookmark" data-id="${bookmark.id}" data-type="bookmark" title="删除">🗑️</button>
          </div>
        </a>
      `;
    }
  }
  
  // 渲染子文件夹 - 默认展开（系统文件夹内的子文件夹默认展开）
  let subFoldersHtml = '';
  if (subFolders.length > 0) {
    for (const folder of subFolders) {
      const count = countBookmarks(folder);
      const isExpanded = !_currentFilter;
      const childrenHtml = await renderFolderBookmarks(folder);
      subFoldersHtml += `
        <div class="bookmark-folder depth-${depth + 1}" data-id="${folder.id}">
          <div class="folder-header" data-action="toggle">
            <span class="folder-icon">📂</span>
            <span class="folder-name">${escapeHtml(folder.title)}</span>
            <span class="folder-count">(${count} 个)</span>
            <span class="folder-toggle${isExpanded ? ' expanded' : ''}">▶</span>
            <div class="folder-actions">
              <button class="action-btn" data-action="add-in-folder" data-parent="${folder.id}" title="在此文件夹添加">➕</button>
              <button class="action-btn edit-btn" data-action="edit-folder" data-id="${folder.id}" title="编辑文件夹">✏️</button>
              <button class="action-btn delete-btn" data-action="delete-folder" data-id="${folder.id}" title="删除文件夹">🗑️</button>
            </div>
          </div>
          <div class="folder-content${_currentFilter || !isExpanded ? ' collapsed' : ''}">
            ${childrenHtml}
          </div>
        </div>
      `;
    }
  }
  
  const folderIcon = node.id === '1' ? '📚' : '📋';
  
  return `
    <div class="site-category" data-system-folder="${node.id}">
      <h3 class="category-title">
        <span class="category-icon">${folderIcon}</span>
        ${escapeHtml(node.title)}
      </h3>
      <div class="category-list">
        ${bookmarksHtml}
      </div>
      ${subFoldersHtml}
    </div>
  `;
}

// 渲染文件夹内的书签
async function renderFolderBookmarks(folder) {
  
  if (!folder.children) return '';
  
  const bookmarks = folder.children.filter(child => child.url);
  const subFolders = folder.children.filter(child => child.children && child.children.length > 0);
  
  let html = '';
  
  // 先渲染所有书签（列表视图，图标会异步加载后更新）
  for (const bookmark of bookmarks) {
    const icon = getBookmarkIcon(bookmark.url, bookmark.title);
    html += `
      <a href="${escapeHtml(bookmark.url)}" class="site-list-item" target="_blank" title="${escapeHtml(bookmark.title)}">
        <div class="site-icon">
          ${icon}
        </div>
        <div class="site-info">
          <span class="site-name">${escapeHtml(bookmark.title)}</span>
          <span class="site-domain">${getDomain(bookmark.url)}</span>
        </div>
        <div class="bookmark-card-actions">
          <button class="action-btn edit-btn" data-action="edit-bookmark" data-id="${bookmark.id}" title="编辑">✏️</button>
          <button class="action-btn delete-btn" data-action="delete-bookmark" data-id="${bookmark.id}" data-type="bookmark" title="删除">🗑️</button>
        </div>
      </a>
    `;
  }
  
  // 再渲染所有子文件夹
  for (const child of subFolders) {
    const count = countBookmarks(child);
    const isExpanded = !_currentFilter;
    const childrenHtml = await renderFolderBookmarks(child);
    html += `
      <div class="bookmark-folder depth-2" data-id="${child.id}">
        <div class="folder-header" data-action="toggle">
          <span class="folder-icon">📁</span>
          <span class="folder-name">${escapeHtml(child.title)}</span>
          <span class="folder-count">(${count} 个)</span>
          <span class="folder-toggle${isExpanded ? ' expanded' : ''}">▶</span>
          <div class="folder-actions">
            <button class="action-btn" data-action="add-in-folder" data-parent="${child.id}" title="在此文件夹添加">➕</button>
            <button class="action-btn edit-btn" data-action="edit-folder" data-id="${child.id}" title="编辑文件夹">✏️</button>
            <button class="action-btn delete-btn" data-action="delete-folder" data-id="${child.id}" title="删除文件夹">🗑️</button>
          </div>
        </div>
        <div class="folder-content${_currentFilter || !isExpanded ? ' collapsed' : ''}">
          ${childrenHtml}
        </div>
      </div>
    `;
  }
  
  return html;
}

// 统计书签数量
function countBookmarks(node) {
  if (!node.children) return 0;
  return node.children.reduce((count, child) => {
    if (child.url) return count + 1;
    return count + countBookmarks(child);
  }, 0);
}

// 筛选书签（支持异步）
async function filterBookmarks(e) {
  _currentFilter = e.target.value;
  await renderBookmarks();
}

// 加载分类选项 - 树形结构
async function loadCategoryOptions() {
  
  if (!_chromeBookmarkTree) {
    await loadChromeBookmarkTree();
  }
  
  const optionsContainer = document.getElementById('treeSelectOptions');
  optionsContainer.innerHTML = '';
  
  // 构建树形数据（只包含文件夹）
  function buildFolderTree(nodes, depth = 0) {
    let html = '';
    
    nodes.forEach(node => {
      // 只处理有 children 的节点（文件夹）
      if (node.children && node.id !== '0') {
        // 检查是否有子文件夹
        const childFolders = node.children.filter(child => child.children && child.id !== '0');
        const hasChildFolders = childFolders.length > 0;
        
        html += `
          <div class="tree-option" data-id="${node.id}" data-title="${escapeHtml(node.title)}">
            ${hasChildFolders ? `<span class="tree-option-toggle">▶</span>` : `<span class="tree-option-indent"></span>`}
            <span class="tree-option-icon">${depth === 0 ? '📚' : '📁'}</span>
            <span class="tree-option-text">${escapeHtml(node.title)}</span>
          </div>
        `;
        
        // 递归处理子文件夹
        if (hasChildFolders) {
          html += `<div class="tree-option-children" data-parent="${node.id}">${buildFolderTree(childFolders, depth + 1)}</div>`;
        }
      }
    });
    
    return html;
  }
  
  // 获取顶级文件夹
  _chromeBookmarkTree.forEach(node => {
    if (node.id === '0' || node.title === '') {
      if (node.children) {
        optionsContainer.innerHTML = buildFolderTree(node.children, 0);
      }
    }
  });
  
  // 初始化树形选择器事件
  initTreeSelectEvents();
}

// 初始化树形选择器事件（只执行一次）
let treeSelectEventsInitialized = false;
function initTreeSelectEvents() {
  if (treeSelectEventsInitialized) return;
  treeSelectEventsInitialized = true;
  
  const container = document.getElementById('treeSelectContainer');
  const input = document.getElementById('treeSelectInput');
  const dropdown = document.getElementById('treeSelectDropdown');
  const textSpan = input.querySelector('.tree-select-text');
  const hiddenInput = document.getElementById('bmCategory');
  
  // 点击输入框展开/收起
  input.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    input.classList.toggle('open');
  });
  
  // 点击选项（使用事件委托）
  dropdown.addEventListener('click', (e) => {
    const toggle = e.target.closest('.tree-option-toggle');
    if (toggle) {
      // 展开/收起子项
      e.stopPropagation();
      const option = toggle.closest('.tree-option');
      const parentId = option.dataset.id;
      const children = dropdown.querySelector(`.tree-option-children[data-parent="${parentId}"]`);
      
      if (children) {
        toggle.classList.toggle('expanded');
        children.classList.toggle('expanded');
      }
      return;
    }
    
    const option = e.target.closest('.tree-option');
    if (option) {
      const id = option.dataset.id;
      const title = option.dataset.title;
      
      // 更新选中状态
      dropdown.querySelectorAll('.tree-option').forEach(el => el.classList.remove('selected'));
      option.classList.add('selected');
      
      // 更新显示
      textSpan.textContent = title;
      hiddenInput.value = id;
      
      // 收起下拉
      dropdown.classList.remove('open');
      input.classList.remove('open');
    }
  });
  
  // 点击外部收起
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.remove('open');
      input.classList.remove('open');
    }
  });
}

// 打开添加书签弹窗
async function openAddBookmark(parentId = null) {
  const modal = document.getElementById('bookmarkModal');
  document.getElementById('bmModalTitle').textContent = '添加书签';
  document.getElementById('bmId').value = '';
  document.getElementById('bmTitle').value = '';
  document.getElementById('bmUrl').value = '';
  document.getElementById('bmParentId').value = parentId || '';
  
  // 重置保存按钮状态
  const saveBtn = modal.querySelector('[data-action="save-bookmark"], [data-action="save-folder"]');
  if (saveBtn) {
    saveBtn.dataset.action = 'save-bookmark';
    saveBtn.textContent = '保存';
  }
  
  // 重置树形选择器为默认状态
  document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = '请选择文件夹';
  document.getElementById('bmCategory').value = '';
  
  // 先加载选项
  await loadCategoryOptions();
  
  // 确定默认文件夹：优先使用传入的parentId，否则使用左侧选中的文件夹
  const defaultFolderId = parentId || _selectedFolderId || '1';
  
  // 查找文件夹名称（递归查找）
  let defaultFolderName = getFolderName(_chromeBookmarkTree, defaultFolderId) || '请选择文件夹';
  
  // 设置值
  document.getElementById('bmCategory').value = defaultFolderId;
  document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = defaultFolderName;
  
  // 选中对应的选项并展开
  const option = document.querySelector(`.tree-option[data-id="${defaultFolderId}"]`);
  if (option) {
    option.classList.add('selected');
    // 展开所有父文件夹并滚动到选中项
    expandAndScrollToFolder(defaultFolderId);
  }
  
  modal.style.display = 'flex';
  document.getElementById('bmTitle').focus();
}

// 打开添加文件夹弹窗
async function openAddFolder(parentId = null) {
  const modal = document.getElementById('bookmarkModal');
  document.getElementById('bmModalTitle').textContent = '添加文件夹';
  document.getElementById('bmId').value = '';
  document.getElementById('bmTitle').value = '';
  document.getElementById('bmUrl').value = '';
  document.getElementById('bmParentId').value = parentId || '';
  
  // 修改保存按钮为保存文件夹
  const saveBtn = modal.querySelector('[data-action="save-bookmark"], [data-action="save-folder"]');
  if (saveBtn) {
    saveBtn.dataset.action = 'save-folder';
    saveBtn.textContent = '保存文件夹';
  }
  
  // 重置树形选择器为默认状态
  document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = '请选择文件夹';
  document.getElementById('bmCategory').value = '';
  
  // 先加载选项
  await loadCategoryOptions();
  
  // 确定默认文件夹：优先使用传入的parentId，否则使用左侧选中的文件夹
  const defaultFolderId = parentId || _selectedFolderId || '1';
  
  // 查找文件夹名称（递归查找）
  let defaultFolderName = getFolderName(_chromeBookmarkTree, defaultFolderId) || '请选择文件夹';
  
  // 设置值
  document.getElementById('bmCategory').value = defaultFolderId;
  document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = defaultFolderName;
  
  // 选中对应的选项并展开
  const option = document.querySelector(`.tree-option[data-id="${defaultFolderId}"]`);
  if (option) {
    option.classList.add('selected');
    // 展开所有父文件夹并滚动到选中项
    expandAndScrollToFolder(defaultFolderId);
  }
  
  modal.style.display = 'flex';
  document.getElementById('bmTitle').focus();
}

// 打开编辑书签弹窗
async function openEditBookmark(id) {
  const node = findBookmarkNode(_chromeBookmarkTree, id);
  if (!node) {
    alert('未找到该书签');
    return;
  }
  
  const modal = document.getElementById('bookmarkModal');
  document.getElementById('bmModalTitle').textContent = '编辑书签';
  document.getElementById('bmId').value = node.id;
  document.getElementById('bmTitle').value = node.title;
  document.getElementById('bmUrl').value = node.url || '';
  
  // 重置保存按钮状态
  const saveBtn = modal.querySelector('[data-action="save-bookmark"], [data-action="save-folder"]');
  if (saveBtn) {
    saveBtn.dataset.action = 'save-bookmark';
    saveBtn.textContent = '保存';
  }
  
  // 获取父文件夹
  const parentNode = findParentNode(_chromeBookmarkTree, node.id);
  const parentId = parentNode ? parentNode.id : null;
  document.getElementById('bmParentId').value = parentId || '';
  
  await loadCategoryOptions();
  
  // 回显所属文件夹
  if (parentId) {
    document.getElementById('bmCategory').value = parentId;
    expandParentFolders(parentId);
    const option = document.querySelector(`.tree-option[data-id="${parentId}"]`);
    if (option) {
      document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = option.dataset.title;
      option.classList.add('selected');
    }
  }
  
  modal.style.display = 'flex';
  document.getElementById('bmTitle').focus();
}

// 展开父文件夹路径，确保指定文件夹可见
function expandParentFolders(targetId) {
  const dropdown = document.getElementById('treeSelectDropdown');
  
  // 找到目标文件夹的选项
  const targetOption = dropdown.querySelector(`.tree-option[data-id="${targetId}"]`);
  if (!targetOption) return;
  
  // 展开目标选项所在的容器（如果有的话）
  let sibling = targetOption.nextElementSibling;
  if (sibling && sibling.classList.contains('tree-option-children') && sibling.dataset.parent === targetId) {
    sibling.classList.add('expanded');
    const toggle = targetOption.querySelector('.tree-option-toggle');
    if (toggle) toggle.classList.add('expanded');
  }
  
  // 递归向上展开所有祖先容器
  function expandUp(element) {
    const parentContainer = element.closest('.tree-option-children');
    if (parentContainer) {
      const parentOption = parentContainer.previousElementSibling;
      if (parentOption && parentOption.classList.contains('tree-option')) {
        parentContainer.classList.add('expanded');
        const toggle = parentOption.querySelector('.tree-option-toggle');
        if (toggle) toggle.classList.add('expanded');
        expandUp(parentOption);
      }
    }
  }
  
  expandUp(targetOption);
}

// 展开所有文件夹并滚动到指定选中项
function expandAndScrollToFolder(folderId) {
  const dropdown = document.getElementById('treeSelectDropdown');
  const optionsContainer = document.getElementById('treeSelectOptions');
  
  // 首先展开所有文件夹
  const allToggles = dropdown.querySelectorAll('.tree-option-toggle');
  allToggles.forEach(toggle => {
    toggle.classList.add('expanded');
  });
  const allChildren = dropdown.querySelectorAll('.tree-option-children');
  allChildren.forEach(children => {
    children.classList.add('expanded');
  });
  
  // 滚动到选中项
  const targetOption = dropdown.querySelector(`.tree-option[data-id="${folderId}"]`);
  if (targetOption && optionsContainer) {
    // 延迟滚动，确保DOM已更新
    setTimeout(() => {
      targetOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }
}

// 打开编辑文件夹弹窗
async function openEditFolder(id) {
  const node = findBookmarkNode(_chromeBookmarkTree, id);
  if (!node) {
    alert('未找到该文件夹');
    return;
  }
  
  const modal = document.getElementById('bookmarkModal');
  document.getElementById('bmModalTitle').textContent = '编辑文件夹';
  document.getElementById('bmId').value = node.id;
  document.getElementById('bmTitle').value = node.title;
  document.getElementById('bmUrl').value = '';
  
  // 修改保存按钮为保存文件夹
  const saveBtn = modal.querySelector('[data-action="save-bookmark"], [data-action="save-folder"]');
  if (saveBtn) {
    saveBtn.dataset.action = 'save-folder';
    saveBtn.textContent = '保存文件夹';
  }
  
  // 获取父文件夹
  const parentNode = findParentNode(_chromeBookmarkTree, node.id);
  const parentId = parentNode ? parentNode.id : null;
  document.getElementById('bmParentId').value = parentId || '';
  
  await loadCategoryOptions();
  
  // 回显所属文件夹
  if (parentId) {
    document.getElementById('bmCategory').value = parentId;
    expandParentFolders(parentId);
    const option = document.querySelector(`.tree-option[data-id="${parentId}"]`);
    if (option) {
      document.getElementById('treeSelectInput').querySelector('.tree-select-text').textContent = option.dataset.title;
      option.classList.add('selected');
    }
  }
  
  modal.style.display = 'flex';
  document.getElementById('bmTitle').focus();
}

// 渲染书签列表（两栏布局）
async function renderBookmarks() {
  const treeContainer = document.getElementById('bookmarkTree');
  const contentContainer = document.getElementById('bookmarkContent');
  
  // 首次加载书签树
  if (!_chromeBookmarkTree) {
    treeContainer.innerHTML = '<div class="loading">加载中...</div>';
    contentContainer.innerHTML = '<div class="content-empty"><div class="content-empty-icon">📂</div><div class="content-empty-text">加载中...</div></div>';
    await loadChromeBookmarkTree();
  }
  
  if (!_chromeBookmarkTree || _chromeBookmarkTree.length === 0) {
    treeContainer.innerHTML = `
      <div class="content-empty">
        <div class="content-empty-icon">📁</div>
        <div class="content-empty-text">暂无书签</div>
      </div>
    `;
    contentContainer.innerHTML = `
      <div class="content-empty">
        <div class="content-empty-icon">📁</div>
        <div class="content-empty-text">暂无书签</div>
        <button class="btn btn-primary" data-action="open-add">添加第一个书签</button>
      </div>
    `;
    return;
  }
  
  // 默认选中第一个文件夹（如果有子文件夹则选中第一个子文件夹）
  if (!_selectedFolderId || !findBookmarkNode(_chromeBookmarkTree, _selectedFolderId)) {
    const root = _chromeBookmarkTree.find(n => n.id === '0' || n.title === '');
    if (root && root.children && root.children.length > 0) {
      const firstFolder = root.children[0];
      // 如果第一个文件夹有子文件夹，选中第一个子文件夹
      const firstChild = firstFolder.children && firstFolder.children.find(c => c.children);
      _selectedFolderId = firstChild ? firstChild.id : firstFolder.id;
    }
  }
  
  // 渲染左侧文件夹树
  renderFolderTree();
  
  // 渲染右侧内容区
  renderFolderContent(_selectedFolderId);
}

// 递归收集所有文件夹ID
function collectAllFolderIds(nodes) {
  if (!nodes) return;
  nodes.forEach(node => {
    // 添加所有有 children 的文件夹（id !== '0'）
    if (node.children && node.id !== '0') {
      _expandedFolders.add(node.id);
      // 递归处理子节点
      collectAllFolderIds(node.children);
    }
  });
}

// 渲染左侧文件夹树
function renderFolderTree() {
  // 首次加载时自动展开所有文件夹
  if (!_initialExpandDone && _chromeBookmarkTree && _chromeBookmarkTree.length > 0) {
    // 找到根节点（id='0'）
    const rootNode = _chromeBookmarkTree.find(node => node.id === '0');
    if (rootNode && rootNode.children) {
      collectAllFolderIds(rootNode.children);
    }
    _initialExpandDone = true;
  }
  
  let html = '';
  
  _chromeBookmarkTree.forEach(node => {
    if (node.id === '0' || node.title === '') {
      if (node.children) {
        node.children.forEach(child => {
          html += renderTreeFolderNode(child, 0);
        });
      }
    }
  });
  
  // 更新 DOM
  document.getElementById('bookmarkTree').innerHTML = html;
}

// 递归渲染树形文件夹节点
function renderTreeFolderNode(node, depth = 0) {
  
  if (!node.children) return '';
  
  const isExpanded = _expandedFolders.has(node.id);
  const isSelected = _selectedFolderId === node.id;
  const icon = depth === 0 ? (node.id === '1' ? '📚' : '📋') : '📂';
  const hasChildren = node.children.some(child => child.children);
  
  let childrenHtml = '';
  if (hasChildren) {
    node.children.forEach(child => {
      if (child.children) {
        childrenHtml += renderTreeFolderNode(child, depth + 1);
      }
    });
  }
  
  const isSystemRoot = (node.id === '1' || node.id === '2');
  return `
    <div class="tree-folder" data-id="${node.id}">
      <div class="tree-folder-header ${isSelected ? 'selected' : ''}" 
           data-action="select-folder" data-id="${node.id}"
           draggable="${!isSystemRoot}">
        ${hasChildren ? `<span class="tree-folder-toggle ${isExpanded ? 'expanded' : ''}" data-action="toggle-folder" data-id="${node.id}">▶</span>` : '<span class="tree-folder-toggle"></span>'}
        <span class="tree-folder-icon">${icon}</span>
        <span class="tree-folder-name">${escapeHtml(node.title)}</span>
      </div>
      ${hasChildren ? `<div class="tree-folder-children ${isExpanded ? 'expanded' : ''}" data-parent="${node.id}">${childrenHtml}</div>` : ''}
    </div>
  `;
}

// 渲染右侧内容区
async function renderFolderContent(folderId) {
  const contentContainer = document.getElementById('bookmarkContent');
  const headerTitle = document.getElementById('contentPanelHeader').querySelector('.content-panel-title');
  
  const folder = findBookmarkNode(_chromeBookmarkTree, folderId);
  
  if (!folder) {
    contentContainer.innerHTML = `
      <div class="content-empty">
        <div class="content-empty-icon">📁</div>
        <div class="content-empty-text">未找到该文件夹</div>
      </div>
    `;
    return;
  }
  
  // 更新标题
  const folderIcon = folderId === '1' ? '📚' : (folderId === '2' ? '📋' : '📂');
  headerTitle.innerHTML = `${folderIcon} ${escapeHtml(folder.title)}`;
  
  if (!folder.children || folder.children.length === 0) {
    contentContainer.innerHTML = `
      <div class="content-empty">
        <div class="content-empty-icon">📂</div>
        <div class="content-empty-text">文件夹为空</div>
        <button class="btn btn-primary" data-action="add-in-folder" data-parent="${folderId}">添加书签</button>
      </div>
    `;
    return;
  }
  
  // 只获取书签（不显示子文件夹，子文件夹在左侧展示）
  const bookmarks = folder.children.filter(child => child.url);
  
  let html = '';
  
  // 渲染书签（列表视图，图标会异步加载后更新）
  if (bookmarks.length > 0) {
    html += '<div class="content-list">';
    for (const bookmark of bookmarks) {
      const icon = getBookmarkIcon(bookmark.url, bookmark.title);
      html += `
        <a href="${escapeHtml(bookmark.url)}" class="site-list-item" target="_blank" title="${escapeHtml(bookmark.title)}">
          <div class="site-icon">
            ${icon}
          </div>
          <div class="site-info">
            <span class="site-name">${escapeHtml(bookmark.title)}</span>
            <span class="site-domain">${getDomain(bookmark.url)}</span>
          </div>
          <div class="bookmark-card-actions">
            <button class="action-btn edit-btn" data-action="edit-bookmark" data-id="${bookmark.id}" title="编辑">✏️</button>
            <button class="action-btn delete-btn" data-action="delete-bookmark" data-id="${bookmark.id}" data-type="bookmark" title="删除">🗑️</button>
          </div>
        </a>
      `;
    }
    html += '</div>';
  }
  
  if (html === '') {
    html = `
      <div class="content-empty">
        <div class="content-empty-icon">📂</div>
        <div class="content-empty-text">文件夹为空</div>
        <button class="btn btn-primary" data-action="add-in-folder" data-parent="${folderId}">添加书签</button>
      </div>
    `;
  }
  
  contentContainer.innerHTML = html;
}

// 渲染子文件夹内的书签（列表视图）
async function renderSubfolderItems(folder) {
  
  if (!folder.children) return '';
  
  let html = '<div class="content-list">';
  
  for (const child of folder.children) {
    if (child.url) {
      const icon = getBookmarkIcon(child.url, child.title);
      html += `
        <a href="${escapeHtml(child.url)}" class="site-list-item" target="_blank" title="${escapeHtml(child.title)}">
          <div class="site-icon">
            ${icon}
          </div>
          <div class="site-info">
            <span class="site-name">${escapeHtml(child.title)}</span>
            <span class="site-domain">${getDomain(child.url)}</span>
          </div>
          <div class="bookmark-card-actions">
            <button class="action-btn edit-btn" data-action="edit-bookmark" data-id="${child.id}" title="编辑">✏️</button>
            <button class="action-btn delete-btn" data-action="delete-bookmark" data-id="${child.id}" data-type="bookmark" title="删除">🗑️</button>
          </div>
        </a>
      `;
    }
  }
  
  html += '</div>';
  return html;
}

// 选择文件夹
function selectFolder(folderId) {
  _selectedFolderId = folderId;
  renderFolderTree();
  renderFolderContent(folderId);
}

// 切换文件夹展开/折叠
function toggleFolder(folderId, event) {
  if (event) {
    event.stopPropagation();
  }
  
  if (_expandedFolders.has(folderId)) {
    _expandedFolders.delete(folderId);
  } else {
    _expandedFolders.add(folderId);
  }
  
  renderFolderTree();
  renderFolderContent(_selectedFolderId);
}

// 刷新书签（重新加载）
async function refreshBookmarks() {
  _chromeBookmarkTree = null;
  await renderBookmarks();
}

// 获取文件夹名称（递归查找）
function getFolderName(nodes, id) {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.id === id) return node.title;
    if (node.children) {
      const found = getFolderName(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// 查找书签节点
function findBookmarkNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findBookmarkNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// 查找节点的父节点
function findParentNode(nodes, childId, parent = null) {
  for (const node of nodes) {
    if (node.id === childId) return parent;
    if (node.children) {
      const found = findParentNode(node.children, childId, node);
      if (found !== null) return found;
    }
  }
  return null;
}

// 关闭弹窗
function closeModal() {
  document.getElementById('bookmarkModal').style.display = 'none';
}

// 关闭确认弹窗
function closeConfirm() {
  document.getElementById('confirmModal').style.display = 'none';
  _pendingDeleteId = null;
  _pendingDeleteType = null;
}

// 保存书签（新增或更新）
async function saveBookmark() {
  const id = document.getElementById('bmId').value.trim();
  const title = document.getElementById('bmTitle').value.trim();
  const url = document.getElementById('bmUrl').value.trim();
  const parentId = document.getElementById('bmCategory').value.trim();  // 从 bmCategory 获取所属文件夹
  
  if (!title) {
    alert('请填写标题');
    return;
  }
  
  // URL 必填（书签必须有 URL）
  if (!id && !url) {
    alert('请填写网址');
    return;
  }
  
  if (url && !isValidUrl(url)) {
    alert('请输入有效的网址');
    return;
  }
  
  try {
    if (id) {
      // 更新书签或文件夹
      await sendMessage({
        action: 'updateChromeBookmark',
        data: { id, title, url, parentId }
      });
      closeModal();
      await refreshBookmarks();
    } else {
      // 新增书签
      await sendMessage({
        action: 'addChromeBookmark',
        data: { title, url, parentId }
      });
      closeModal();
      await refreshBookmarks();
    }
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 保存文件夹
async function saveFolder() {
  const id = document.getElementById('bmId').value.trim();
  const title = document.getElementById('bmTitle').value.trim();
  const parentId = document.getElementById('bmCategory').value.trim();
  
  if (!title) {
    alert('请填写文件夹名称');
    return;
  }
  
  try {
    if (id) {
      // 更新文件夹
      await sendMessage({
        action: 'updateChromeBookmark',
        data: { id, title, parentId }
      });
    } else {
      // 新增文件夹
      await sendMessage({
        action: 'addChromeFolder',
        data: { title, parentId }
      });
    }
    closeModal();
    await refreshBookmarks();
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

// 显示删除确认
function showDeleteConfirm(id, type) {
  _pendingDeleteId = id;
  _pendingDeleteType = type;
  
  const message = type === 'folder' 
    ? '确定要删除这个文件夹及其所有内容吗？此操作不可撤销。'
    : '确定要删除这个书签吗？';
  
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmModal').style.display = 'flex';
}

// 确认删除
async function confirmDelete() {
  if (!_pendingDeleteId) {
    alert('无效的ID');
    return;
  }
  
  
  try {
    let response;
    const deleteId = String(_pendingDeleteId);
    
    if (_pendingDeleteType === 'folder') {
      response = await sendMessage({
        action: 'deleteChromeBookmarkTree',
        data: { id: deleteId }
      });
    } else {
      response = await sendMessage({
        action: 'deleteChromeBookmark',
        data: { id: deleteId }
      });
    }
    
    if (!response || !response.success) {
      throw new Error(response?.error || '删除失败');
    }
    
    closeConfirm();
    await refreshBookmarks();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// 删除书签
function deleteBookmark(id) {
  showDeleteConfirm(id, 'bookmark');
}

// 删除文件夹
function deleteFolder(id) {
  showDeleteConfirm(id, 'folder');
}

// 编辑书签
function editBookmark(id) {
  openEditBookmark(id);
}

// 编辑文件夹
function editFolder(id) {
  openEditFolder(id);
}

// 右键菜单上下文（当前操作的文件夹信息）
let _contextMenuData = null;

// 拖拽相关
let _dragSourceId = null;          // 正在拖拽的文件夹 ID
let _dragOverTargetId = null;      // 当前悬停的目标文件夹 ID
let _dragOverPosition = null;      // 'before' | 'after' | 'inside'

// 创建右键菜单 DOM（单例）
function getContextMenuEl() {
  let menu = document.getElementById('treeContextMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'treeContextMenu';
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="rename">
        <span class="context-menu-icon">✏️</span>
        <span>重命名</span>
      </button>
      <div class="context-menu-divider"></div>
      <button class="context-menu-item danger" data-action="delete">
        <span class="context-menu-icon">🗑️</span>
        <span>删除</span>
      </button>
    `;
    document.body.appendChild(menu);

    // 点击菜单项
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item || !_contextMenuData) return;
      const action = item.dataset.action;
      const folderId = _contextMenuData.folderId;
      hideContextMenu();
      if (action === 'rename') {
        openEditFolder(folderId);
      } else if (action === 'delete') {
        showDeleteConfirm(folderId, 'folder');
      }
    });
  }
  return menu;
}

// 显示右键菜单
function showContextMenu(x, y, folderId) {
  const node = findBookmarkNode(_chromeBookmarkTree, folderId);
  if (!node) return;

  _contextMenuData = { folderId, node };

  const menu = getContextMenuEl();

  // 检查是否为系统级根文件夹（书签栏、其他书签）
  const isSystemRoot = (node.id === '1' || node.id === '2');

  // 系统根文件夹不允许删除
  const deleteItem = menu.querySelector('[data-action="delete"]');
  if (deleteItem) {
    deleteItem.style.display = isSystemRoot ? 'none' : '';
  }

  // 系统根文件夹不允许重命名
  const renameItem = menu.querySelector('[data-action="rename"]');
  if (renameItem) {
    renameItem.style.display = isSystemRoot ? 'none' : '';
  }

  // 如果没有可用操作，不显示菜单
  if (isSystemRoot) return;

  menu.style.display = 'block';
  menu.classList.add('show');

  // 确保菜单不超出视口
  const menuRect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  if (x + 170 > window.innerWidth) left = x - 170;
  if (y + 80 > window.innerHeight) top = y - 80;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

// 隐藏右键菜单
function hideContextMenu() {
  const menu = document.getElementById('treeContextMenu');
  if (menu) {
    menu.style.display = 'none';
    menu.classList.remove('show');
  }
  _contextMenuData = null;
}

// 获取拖拽指示器 DOM（单例）
function getDragIndicatorEl() {
  let el = document.getElementById('dragIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dragIndicator';
    el.className = 'drag-indicator';
    document.body.appendChild(el);
  }
  return el;
}

// 检查 nodeId 是否是 ancestorId 的后代节点
function isDescendantOf(nodeId, ancestorId) {
  const node = findBookmarkNode(_chromeBookmarkTree, nodeId);
  if (!node || nodeId === ancestorId) return false;
  const parent = findParentNode(_chromeBookmarkTree, nodeId);
  if (!parent) return false;
  if (parent.id === ancestorId) return true;
  return isDescendantOf(parent.id, ancestorId);
}

// 拖拽开始
function handleTreeDragStart(e) {
  const header = e.target.closest('.tree-folder-header');
  if (!header) { e.preventDefault(); return; }
  const folderId = header.dataset.id;
  if (!folderId) { e.preventDefault(); return; }

  // 系统根文件夹不可拖拽
  if (folderId === '1' || folderId === '2') { e.preventDefault(); return; }

  _dragSourceId = folderId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', folderId);

  // 设置拖拽半透明效果
  const folderEl = header.closest('.tree-folder');
  if (folderEl) {
    requestAnimationFrame(() => {
      folderEl.classList.add('dragging-source');
    });
  }
}

// 拖拽悬停
function handleTreeDragOver(e) {
  if (!_dragSourceId) return;

  // 标记为有效放置区域，保证 drop 事件能触发
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // 获取面板中所有可见的 header（排除正在拖拽的源）
  const panel = document.getElementById('bookmarkTreePanel');
  if (!panel) return;

  const allHeaders = Array.from(panel.querySelectorAll('.tree-folder-header'))
    .filter(h => h.dataset.id !== _dragSourceId);

  if (allHeaders.length === 0) return;

  // 找到光标所在位置对应的目标和插入方向
  // 策略：找光标最接近哪个 header 的上边缘或下边缘
  let targetId = null;
  let targetHeader = null;
  let position = null;

  const cursorY = e.clientY;

  // 检查光标是否在某个 header 内部
  for (const h of allHeaders) {
    const rect = h.getBoundingClientRect();
    if (cursorY >= rect.top && cursorY <= rect.bottom) {
      targetHeader = h;
      targetId = h.dataset.id;
      // 上半部分 = before，下半部分 = after
      const midY = rect.top + rect.height / 2;
      position = cursorY < midY ? 'before' : 'after';
      break;
    }
  }

  // 如果光标不在任何 header 内，找最近的边缘
  if (!targetId) {
    let minDist = Infinity;
    for (const h of allHeaders) {
      const rect = h.getBoundingClientRect();
      // 距离上边缘
      const distTop = Math.abs(cursorY - rect.top);
      // 距离下边缘
      const distBottom = Math.abs(cursorY - rect.bottom);

      if (distTop < minDist) {
        minDist = distTop;
        targetId = h.dataset.id;
        targetHeader = h;
        position = 'before';
      }
      if (distBottom < minDist) {
        minDist = distBottom;
        targetId = h.dataset.id;
        targetHeader = h;
        position = 'after';
      }
    }
  }

  if (!targetId || !targetHeader) return;

  // 不能拖到后代上
  if (isDescendantOf(targetId, _dragSourceId)) {
    clearDragHighlight();
    return;
  }

  // 如果目标和位置没变，不重复更新 DOM
  if (_dragOverTargetId === targetId && _dragOverPosition === position) {
    return;
  }

  // 清除旧的高亮
  clearDragHighlight();

  _dragOverTargetId = targetId;
  _dragOverPosition = position;

  // 显示指示线（始终基于 header 边界）
  const indicator = getDragIndicatorEl();
  const headerRect = targetHeader.getBoundingClientRect();
  indicator.style.left = headerRect.left + 'px';
  indicator.style.width = headerRect.width + 'px';
  indicator.style.top = (position === 'before' ? headerRect.top : headerRect.bottom) + 'px';
  indicator.style.display = 'block';
}

// 清除拖拽高亮
function clearDragHighlight() {
  const prev = document.querySelector('.drag-over-inside');
  if (prev) prev.classList.remove('drag-over-inside');
  const indicator = document.getElementById('dragIndicator');
  if (indicator) indicator.style.display = 'none';
  _dragOverTargetId = null;
  _dragOverPosition = null;
}

// 拖拽结束
function handleTreeDragEnd(e) {
  const sourceEl = document.querySelector('.tree-folder.dragging-source');
  if (sourceEl) sourceEl.classList.remove('dragging-source');
  clearDragHighlight();
  _dragSourceId = null;
}

// 放置
async function handleTreeDrop(e) {
  e.preventDefault();

  const sourceId = _dragSourceId;
  if (!sourceId) {
    handleTreeDragEnd(e);
    return;
  }

  // 在 drop 时重新计算目标位置（不依赖可能过时的 dragover 状态）
  let targetId = _dragOverTargetId;
  let position = _dragOverPosition;

  // 如果 dragover 状态丢失，尝试从 drop 事件位置重新计算
  if (!targetId || !position) {
    const panel = document.getElementById('bookmarkTreePanel');
    if (panel) {
      const allHeaders = Array.from(panel.querySelectorAll('.tree-folder-header'))
        .filter(h => h.dataset.id !== sourceId);
      const cursorY = e.clientY;

      for (const h of allHeaders) {
        const rect = h.getBoundingClientRect();
        if (cursorY >= rect.top && cursorY <= rect.bottom) {
          targetId = h.dataset.id;
          const midY = rect.top + rect.height / 2;
          position = cursorY < midY ? 'before' : 'after';
          break;
        }
      }

      if (!targetId) {
        let minDist = Infinity;
        for (const h of allHeaders) {
          const rect = h.getBoundingClientRect();
          const distTop = Math.abs(cursorY - rect.top);
          const distBottom = Math.abs(cursorY - rect.bottom);
          if (distTop < minDist) {
            minDist = distTop;
            targetId = h.dataset.id;
            position = 'before';
          }
          if (distBottom < minDist) {
            minDist = distBottom;
            targetId = h.dataset.id;
            position = 'after';
          }
        }
      }
    }
  }

  // 清理拖拽状态
  handleTreeDragEnd(e);

  if (!targetId || !position) return;

  try {
      const targetNode = findBookmarkNode(_chromeBookmarkTree, targetId);
    if (!targetNode) throw new Error('目标文件夹未找到');

    let parentId, index;

    // 插入到目标文件夹的前面或后面（在其父级中）
    const targetParent = findParentNode(_chromeBookmarkTree, targetId);
    if (!targetParent) throw new Error('无法找到目标父文件夹');
    parentId = targetParent.id;

    // 获取目标在父级中的索引
    const targetIdx = (targetParent.children || []).findIndex(c => c.id === targetId);
    if (targetIdx === -1) throw new Error('无法计算位置');

    index = position === 'before' ? targetIdx : targetIdx + 1;

    // 注意：Chrome bookmarks.move 的 index 是基于原始数组的位置
    // Chrome 内部会自动处理同父级移动时的索引偏移，无需手动调整

    // 防止移到自己的子文件夹中
    if (isDescendantOf(parentId, sourceId)) {
      alert('不能将文件夹移动到它自己的子文件夹中');
      return;
    }

    // 发送移动请求
    let moveOk = false;
    try {
      await sendMessage({
        action: 'moveBookmark',
        data: { id: sourceId, parentId, index }
      });
      moveOk = true;
    } catch (msgErr) {
      if (msgErr.message && msgErr.message.includes('port closed')) {
        moveOk = true;
      } else {
        throw msgErr;
      }
    }

    // 重新加载书签树
    if (moveOk) {
      let retries = 2;
      while (retries > 0) {
        try {
          await loadChromeBookmarkTree();
          break;
        } catch (loadErr) {
          retries--;
          if (retries === 0) throw loadErr;
          await new Promise(r => setTimeout(r, 300));
        }
      }
      _initialExpandDone = false;
      await renderBookmarks();
    }

  } catch (err) {
    alert('移动失败: ' + err.message);
  }
}

// 拖拽离开树面板
function handleTreeDragLeave(e) {
  const panel = document.getElementById('bookmarkTreePanel');
  if (panel && !panel.contains(e.relatedTarget)) {
    clearDragHighlight();
  }
}

function exportBookmarks() {
  if (!_chromeBookmarkTree) {
    alert('书签数据未加载');
    return;
  }
  
  // 清理数据中的非标准属性
  function cleanNode(node) {
    const clean = { title: node.title };
    if (node.url) {
      clean.url = node.url;
    }
    if (node.children && node.children.length > 0) {
      clean.children = node.children.map(cleanNode);
    }
    return clean;
  }
  
  // 只导出根节点下的书签栏和其他自定义文件夹
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    bookmarks: _chromeBookmarkTree.map(node => cleanNode(node))
  };
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `linkhub-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

// 导入书签
function importBookmarks() {
  document.getElementById('importFileInput').click();
}

// 待导入的书签数据
let _pendingImportData = null;

// 处理文件选择
async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
      throw new Error('文件格式不正确');
    }
    
    // 保存待导入数据
    _pendingImportData = data.bookmarks;
    
    // 显示导入选择弹窗
    document.getElementById('importModal').style.display = 'flex';
    
  } catch (err) {
    alert('读取文件失败: ' + err.message);
  }
  
  // 清空文件选择
  event.target.value = '';
}

// 合并导入
async function importMerge() {
  if (!_pendingImportData) return;
  
  try {
      
    // 使用批量导入接口（会自动识别浏览器默认文件夹并映射到 Chrome 位置）
    const result = await sendMessage({
      action: 'batchImportBookmarks',
      data: {
        bookmarks: _pendingImportData,
        mode: 'merge'
      }
    });
    
    if (!result.success) {
      throw new Error(result.error || '导入失败');
    }
    
    closeImportModal();
    alert(`成功导入 ${result.data.bookmarks} 个书签，${result.data.folders} 个文件夹`);
    await refreshBookmarks();
    
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
}

// 覆盖导入
async function importReplace() {
  if (!_pendingImportData) return;
  
  try {
      
    // 先清空书签栏和其他书签下的所有内容
    await sendMessage({
      action: 'batchDeleteBookmarks',
      data: { folderId: '1' }
    });
    await sendMessage({
      action: 'batchDeleteBookmarks',
      data: { folderId: '2' }
    });
    
    // 然后导入新数据（覆盖模式直接导入，不合并）
    const result = await sendMessage({
      action: 'batchImportBookmarks',
      data: {
        bookmarks: _pendingImportData,
        mode: 'replace'
      }
    });
    
    if (!result.success) {
      throw new Error(result.error || '导入失败');
    }
    
    closeImportModal();
    alert(`成功导入 ${result.data.bookmarks} 个书签，${result.data.folders} 个文件夹`);
    await refreshBookmarks();
    
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
}

// 关闭导入弹窗
function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
  _pendingImportData = null;
}

// 初始化导入文件输入框
document.addEventListener('DOMContentLoaded', async () => {
  const importInput = document.getElementById('importFileInput');
  if (importInput) {
    importInput.addEventListener('change', handleImportFile);
  }
});

// ===== 导出 =====

export {
  loadChromeBookmarkTree,
  renderBookmarks,
  filterBookmarks,
  refreshBookmarks,
  openAddBookmark,
  openAddFolder,
  saveBookmark,
  saveFolder,
  deleteBookmark,
  deleteFolder,
  editBookmark,
  editFolder,
  selectFolder,
  toggleFolder,
  confirmDelete,
  closeModal,
  closeConfirm,
  exportBookmarks,
  importBookmarks,
  importMerge,
  importReplace,
  closeImportModal,
  showContextMenu,
  hideContextMenu,
  handleTreeDragStart,
  handleTreeDragOver,
  handleTreeDragLeave,
  handleTreeDrop,
  handleTreeDragEnd
};

export function getBookmarkTree() {
  return _chromeBookmarkTree;
}

export function initBookmarks() {
  initSplitter();
}

function initSplitter() {
  const splitter = document.getElementById('bookmarkSplitter');
  const treePanel = document.getElementById('bookmarkTreePanel');
  if (!splitter || !treePanel) return;

  let isDragging = false;

  splitter.addEventListener('mousedown', () => {
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const layoutRect = document.querySelector('.bookmark-layout')?.getBoundingClientRect();
    if (!layoutRect) return;
    const newWidth = e.clientX - layoutRect.left;
    if (newWidth >= 180 && newWidth <= 500) {
      treePanel.style.width = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}
