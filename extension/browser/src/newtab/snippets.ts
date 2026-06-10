/**
 * LinkHub - 代码片段管理模块
 */

import { escapeHtml } from './utils';

// ===== 类型定义 =====

interface Snippet {
  id: string;
  title: string;
  content: string;
  language: string;
  group: string;
  createdAt: number;
  updatedAt: number;
}

interface SnippetGroup {
  id: string;
  name: string;
}

// ===== 状态 =====

let snippets: Snippet[] = [];
let snippetGroups: SnippetGroup[] = [];
let selectedGroup = 'all';
let searchQuery = '';
let editingGroupId: string | null = null;

// 语言选项
const LANGUAGES = [
  { value: 'shell', label: 'Shell' },
  { value: 'sql', label: 'SQL' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: '纯文本' },
];

// ===== 数据持久化 =====

function loadData(): void {
  try {
    const s = localStorage.getItem('linkhub-snippets');
    if (s) snippets = JSON.parse(s);
    const g = localStorage.getItem('linkhub-snippet-groups');
    if (g) snippetGroups = JSON.parse(g);
  } catch (e) {
    console.warn('[snippets] Failed to load data:', e);
  }
}

function saveData(): void {
  localStorage.setItem('linkhub-snippets', JSON.stringify(snippets));
  localStorage.setItem('linkhub-snippet-groups', JSON.stringify(snippetGroups));
}

// ===== 初始化 =====

let initialized = false;

export function initSnippets(): void {
  if (!initialized) {
    loadData();
    setupEvents();
    initialized = true;
  }
  renderSnippets();
}

function setupEvents(): void {
  // 搜索框
  const searchInput = document.getElementById('snippetSearch') as HTMLInputElement | null;
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderList();
  });
}

// ===== 片段 CRUD =====

export function openAddSnippet(): void {
  const modal = document.getElementById('snippetModal')!;
  document.getElementById('snippetModalTitle')!.textContent = '添加片段';
  (document.getElementById('snippetEditId') as HTMLInputElement).value = '';
  (document.getElementById('snippetEditTitle') as HTMLInputElement).value = '';
  (document.getElementById('snippetEditContent') as HTMLTextAreaElement).value = '';
  (document.getElementById('snippetEditLanguage') as HTMLSelectElement).value = 'shell';
  updateSnippetGroupSelect('');
  modal.style.display = 'flex';
  (document.getElementById('snippetEditTitle') as HTMLInputElement).focus();
}

export function openEditSnippet(id: string): void {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  const modal = document.getElementById('snippetModal')!;
  document.getElementById('snippetModalTitle')!.textContent = '编辑片段';
  (document.getElementById('snippetEditId') as HTMLInputElement).value = snippet.id;
  (document.getElementById('snippetEditTitle') as HTMLInputElement).value = snippet.title;
  (document.getElementById('snippetEditContent') as HTMLTextAreaElement).value = snippet.content;
  (document.getElementById('snippetEditLanguage') as HTMLSelectElement).value = snippet.language;
  updateSnippetGroupSelect(snippet.group);
  modal.style.display = 'flex';
  (document.getElementById('snippetEditTitle') as HTMLInputElement).focus();
}

function updateSnippetGroupSelect(selectedId: string): void {
  const select = document.getElementById('snippetEditGroup') as HTMLSelectElement;
  let html = '<option value="">无分组</option>';
  for (const g of snippetGroups) {
    html += `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`;
  }
  select.innerHTML = html;
}

export function saveSnippet(): void {
  const id = (document.getElementById('snippetEditId') as HTMLInputElement).value;
  const title = (document.getElementById('snippetEditTitle') as HTMLInputElement).value.trim();
  const content = (document.getElementById('snippetEditContent') as HTMLTextAreaElement).value;
  const language = (document.getElementById('snippetEditLanguage') as HTMLSelectElement).value;
  const group = (document.getElementById('snippetEditGroup') as HTMLSelectElement).value;

  if (!title) { alert('请输入片段名称'); return; }
  if (!content) { alert('请输入片段内容'); return; }

  if (id) {
    const snippet = snippets.find(s => s.id === id);
    if (snippet) {
      snippet.title = title;
      snippet.content = content;
      snippet.language = language;
      snippet.group = group;
      snippet.updatedAt = Date.now();
    }
  } else {
    snippets.push({
      id: Date.now().toString(),
      title, content, language, group,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  saveData();
  closeSnippetModal();
  renderSnippets();
}

export function deleteSnippet(id: string): void {
  if (!confirm('确定删除这个片段？')) return;
  snippets = snippets.filter(s => s.id !== id);
  saveData();
  renderSnippets();
}

export function closeSnippetModal(): void {
  document.getElementById('snippetModal')!.style.display = 'none';
}

// ===== 复制 & 发送 =====

export function copySnippet(id: string): void {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;
  navigator.clipboard.writeText(snippet.content).then(() => {
    showToast('✓ 已复制到剪贴板');
  });
}

export function sendSnippetToTerminal(id: string): void {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;
  // 调用终端模块的发送函数（通过全局事件）
  const event = new CustomEvent('linkhub-send-to-terminal', { detail: snippet.content });
  document.dispatchEvent(event);
  showToast('✓ 已发送到终端');
}

// ===== 分组管理 =====

export function addSnippetGroup(): void {
  editingGroupId = null;
  document.getElementById('snippetGroupModalTitle')!.textContent = '添加分组';
  (document.getElementById('snippetGroupNameInput') as HTMLInputElement).value = '';
  document.getElementById('snippetGroupModal')!.style.display = 'flex';
  (document.getElementById('snippetGroupNameInput') as HTMLInputElement).focus();
}

export function saveSnippetGroup(): void {
  const name = (document.getElementById('snippetGroupNameInput') as HTMLInputElement).value.trim();
  if (!name) { alert('请输入分组名称'); return; }

  if (editingGroupId) {
    const group = snippetGroups.find(g => g.id === editingGroupId);
    if (group) group.name = name;
  } else {
    snippetGroups.push({ id: Date.now().toString(), name });
  }

  saveData();
  closeSnippetGroupModal();
  renderSnippets();
}

export function closeSnippetGroupModal(): void {
  document.getElementById('snippetGroupModal')!.style.display = 'none';
  editingGroupId = null;
}

export function deleteSnippetGroup(groupId: string): void {
  if (!confirm('确定删除分组？（片段不会被删除）')) return;
  snippetGroups = snippetGroups.filter(g => g.id !== groupId);
  snippets.forEach(s => { if (s.group === groupId) s.group = ''; });
  saveData();
  if (selectedGroup === groupId) selectedGroup = 'all';
  renderSnippets();
}

export function selectSnippetGroup(groupId: string): void {
  selectedGroup = groupId;
  renderSnippets();
}

// ===== 渲染 =====

function renderSnippets(): void {
  renderGroups();
  renderList();
}

function renderGroups(): void {
  const container = document.getElementById('snippetGroupList');
  if (!container) return;

  const allCount = snippets.length;
  let html = `<div class="snippet-group-item ${selectedGroup === 'all' ? 'active' : ''}" data-action="select-snippet-group" data-group="all">
    <span class="snippet-group-name">全部</span>
    <span class="snippet-group-count">${allCount}</span>
  </div>`;

  for (const g of snippetGroups) {
    const count = snippets.filter(s => s.group === g.id).length;
    html += `<div class="snippet-group-item ${selectedGroup === g.id ? 'active' : ''}" data-action="select-snippet-group" data-group="${g.id}">
      <span class="snippet-group-name">${escapeHtml(g.name)}</span>
      <span class="snippet-group-count">${count}</span>
      <span class="snippet-group-del" data-action="delete-snippet-group" data-group="${g.id}" title="删除">×</span>
    </div>`;
  }

  container.innerHTML = html;
}

function renderList(): void {
  const container = document.getElementById('snippetList');
  if (!container) return;

  let list = snippets;

  // 按分组筛选
  if (selectedGroup !== 'all') {
    list = list.filter(s => s.group === selectedGroup);
  }

  // 搜索过滤
  if (searchQuery) {
    const lower = searchQuery.toLowerCase();
    list = list.filter(s =>
      s.title.toLowerCase().includes(lower) ||
      s.content.toLowerCase().includes(lower)
    );
  }

  // 按更新时间倒序
  list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);

  if (list.length === 0) {
    container.innerHTML = `<div class="snippet-empty">${searchQuery ? '没有匹配的片段' : '暂无片段，点击右上角 + 添加'}</div>`;
    return;
  }

  container.innerHTML = list.map(s => renderSnippetCard(s)).join('');
}

function renderSnippetCard(snippet: Snippet): string {
  const langLabel = LANGUAGES.find(l => l.value === snippet.language)?.label || snippet.language;
  const groupName = snippetGroups.find(g => g.id === snippet.group)?.name || '';
  // 显示前 5 行
  const lines = snippet.content.split('\n');
  const preview = lines.slice(0, 5).join('\n');
  const hasMore = lines.length > 5;

  return `
    <div class="snippet-card" data-id="${snippet.id}">
      <div class="snippet-card-header">
        <span class="snippet-card-title">${escapeHtml(snippet.title)}</span>
        <div class="snippet-card-tags">
          <span class="snippet-tag snippet-tag-lang">${escapeHtml(langLabel)}</span>
          ${groupName ? `<span class="snippet-tag snippet-tag-group">${escapeHtml(groupName)}</span>` : ''}
        </div>
      </div>
      <pre class="snippet-card-code"><code>${escapeHtml(preview)}${hasMore ? '\n...' : ''}</code></pre>
      <div class="snippet-card-actions">
        <button class="snippet-action-btn" data-action="copy-snippet" data-id="${snippet.id}" title="复制">📋 复制</button>
        <button class="snippet-action-btn" data-action="send-snippet" data-id="${snippet.id}" title="发送到终端">⚡ 发送</button>
        <button class="snippet-action-btn" data-action="edit-snippet" data-id="${snippet.id}" title="编辑">✏️</button>
        <button class="snippet-action-btn snippet-action-del" data-action="delete-snippet" data-id="${snippet.id}" title="删除">🗑️</button>
      </div>
    </div>
  `;
}

// ===== 工具函数 =====

function showToast(msg: string): void {
  const existing = document.querySelector('.copy-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

// ===== 供命令面板搜索 =====

export function getSnippetsForSearch(): Array<{ title: string; content: string; id: string }> {
  return snippets.map(s => ({ title: s.title, content: s.content, id: s.id }));
}
