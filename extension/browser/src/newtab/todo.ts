/**
 * LinkHub - 待办模块
 */

import { escapeHtml } from './utils';

// ===== 类型定义 =====

interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  priority: 'high' | 'normal' | 'low';
  group: string;
  createdAt: number;
  doneAt: number | null;
  note: string;
  link: string;
}

interface TodoGroup {
  id: string;
  name: string;
}

// ===== 状态 =====

let todos: TodoItem[] = [];
let todoGroups: TodoGroup[] = [];
let selectedGroup = 'all';
let editingGroupId: string | null = null;
let dragTodoId: string | null = null;

// ===== 数据持久化 =====

function loadData(): void {
  try {
    const t = localStorage.getItem('linkhub-todos');
    if (t) todos = JSON.parse(t);
    const g = localStorage.getItem('linkhub-todo-groups');
    if (g) todoGroups = JSON.parse(g);
  } catch (e) {
    console.warn('[todo] Failed to load data:', e);
  }
}

function saveData(): void {
  localStorage.setItem('linkhub-todos', JSON.stringify(todos));
  localStorage.setItem('linkhub-todo-groups', JSON.stringify(todoGroups));
}

// ===== 初始化 =====

export function initTodo(): void {
  loadData();
  setupEvents();
  renderTodo();
}

function setupEvents(): void {
  const input = document.getElementById('todoInput') as HTMLInputElement | null;
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTodo();
    }
  });

  // 拖拽事件（只注册一次）
  const todoListEl = document.getElementById('todoList');
  if (todoListEl) {
    todoListEl.addEventListener('dragstart', handleDragStart);
    todoListEl.addEventListener('dragover', handleDragOver);
    todoListEl.addEventListener('dragleave', handleDragLeave);
    todoListEl.addEventListener('drop', handleDrop);
    todoListEl.addEventListener('dragend', handleDragEnd);
  }
}

// ===== 待办 CRUD =====

export function addTodo(): void {
  const input = document.getElementById('todoInput') as HTMLInputElement;
  const title = input.value.trim();
  if (!title) return;

  const priority = (document.getElementById('todoPrioritySelect') as HTMLSelectElement).value as TodoItem['priority'];
  const group = selectedGroup === 'all' ? '' : selectedGroup;

  todos.push({
    id: Date.now().toString(),
    title,
    done: false,
    priority,
    group,
    createdAt: Date.now(),
    doneAt: null,
    note: '',
    link: ''
  });

  saveData();
  input.value = '';
  renderTodo();
}

export function toggleTodo(id: string): void {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  todo.doneAt = todo.done ? Date.now() : null;
  saveData();
  renderTodo();
}

export function deleteTodo(id: string): void {
  todos = todos.filter(t => t.id !== id);
  saveData();
  renderTodo();
}

// ===== 编辑弹窗 =====

export function openEditTodo(id: string): void {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  (document.getElementById('todoEditId') as HTMLInputElement).value = todo.id;
  (document.getElementById('todoEditTitle') as HTMLInputElement).value = todo.title;
  (document.getElementById('todoEditPriority') as HTMLSelectElement).value = todo.priority;
  (document.getElementById('todoEditLink') as HTMLInputElement).value = todo.link || '';
  (document.getElementById('todoEditNote') as HTMLInputElement).value = todo.note || '';

  const groupSelect = document.getElementById('todoEditGroup') as HTMLSelectElement;
  let html = '<option value="">无分组</option>';
  for (const g of todoGroups) {
    html += `<option value="${g.id}" ${todo.group === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`;
  }
  groupSelect.innerHTML = html;

  document.getElementById('todoEditModal')!.style.display = 'flex';
  (document.getElementById('todoEditTitle') as HTMLInputElement).focus();
}

export function saveEditTodo(): void {
  const id = (document.getElementById('todoEditId') as HTMLInputElement).value;
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const title = (document.getElementById('todoEditTitle') as HTMLInputElement).value.trim();
  if (!title) {
    alert('标题不能为空');
    return;
  }

  todo.title = title;
  todo.priority = (document.getElementById('todoEditPriority') as HTMLSelectElement).value as TodoItem['priority'];
  todo.group = (document.getElementById('todoEditGroup') as HTMLSelectElement).value;
  todo.link = (document.getElementById('todoEditLink') as HTMLInputElement).value.trim();
  todo.note = (document.getElementById('todoEditNote') as HTMLInputElement).value.trim();

  saveData();
  closeEditTodoModal();
  renderTodo();
}

export function closeEditTodoModal(): void {
  document.getElementById('todoEditModal')!.style.display = 'none';
}

// ===== 分组管理 =====

export function addTodoGroup(): void {
  editingGroupId = null;
  document.getElementById('todoGroupModalTitle')!.textContent = '添加分组';
  (document.getElementById('todoGroupNameInput') as HTMLInputElement).value = '';
  document.getElementById('todoGroupModal')!.style.display = 'flex';
  (document.getElementById('todoGroupNameInput') as HTMLInputElement).focus();
}

export function saveTodoGroup(): void {
  const name = (document.getElementById('todoGroupNameInput') as HTMLInputElement).value.trim();
  if (!name) {
    alert('请输入分组名称');
    return;
  }

  if (editingGroupId) {
    const group = todoGroups.find(g => g.id === editingGroupId);
    if (group) group.name = name;
  } else {
    todoGroups.push({ id: Date.now().toString(), name });
  }

  saveData();
  closeTodoGroupModal();
  renderGroups();
}

export function closeTodoGroupModal(): void {
  document.getElementById('todoGroupModal')!.style.display = 'none';
  editingGroupId = null;
}

export function deleteTodoGroup(groupId: string): void {
  if (!confirm('确定删除这个分组？（待办不会被删除）')) return;
  todoGroups = todoGroups.filter(g => g.id !== groupId);
  todos.forEach(t => { if (t.group === groupId) t.group = ''; });
  saveData();
  if (selectedGroup === groupId) selectedGroup = 'all';
  renderGroups();
  renderTodo();
}

export function selectTodoGroup(groupId: string): void {
  selectedGroup = groupId;
  renderGroups();
  renderTodo();
}

// ===== 拖拽排序 =====

function handleDragStart(e: DragEvent): void {
  const item = (e.target as HTMLElement).closest('.todo-item') as HTMLElement | null;
  if (!item) return;
  dragTodoId = item.dataset.id || null;
  item.classList.add('dragging');
  e.dataTransfer!.effectAllowed = 'move';
}

function handleDragOver(e: DragEvent): void {
  e.preventDefault();
  const item = (e.target as HTMLElement).closest('.todo-item') as HTMLElement | null;
  if (!item || item.dataset.id === dragTodoId) return;
  item.classList.add('drag-over');
}

function handleDragLeave(e: DragEvent): void {
  const item = (e.target as HTMLElement).closest('.todo-item') as HTMLElement | null;
  if (item) item.classList.remove('drag-over');
}

function handleDrop(e: DragEvent): void {
  e.preventDefault();
  const targetItem = (e.target as HTMLElement).closest('.todo-item') as HTMLElement | null;
  if (!targetItem || !dragTodoId) return;
  targetItem.classList.remove('drag-over');

  const targetId = targetItem.dataset.id;
  if (targetId === dragTodoId) return;

  const undone = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);

  const fromIdx = undone.findIndex(t => t.id === dragTodoId);
  const toIdx = undone.findIndex(t => t.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [moved] = undone.splice(fromIdx, 1);
  undone.splice(toIdx, 0, moved);

  todos = [...undone, ...done];
  saveData();
  renderTodo();
}

function handleDragEnd(): void {
  dragTodoId = null;
  document.querySelectorAll('.todo-item.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.todo-item.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// ===== 渲染 =====

function renderGroups(): void {
  const container = document.getElementById('todoGroups');
  if (!container) return;

  const allCount = todos.filter(t => !t.done).length;
  let html = `<button class="todo-group-tab ${selectedGroup === 'all' ? 'active' : ''}" data-action="select-todo-group" data-group="all">全部 (${allCount})</button>`;

  for (const g of todoGroups) {
    const count = todos.filter(t => !t.done && t.group === g.id).length;
    html += `<button class="todo-group-tab ${selectedGroup === g.id ? 'active' : ''}" data-action="select-todo-group" data-group="${g.id}">
      ${escapeHtml(g.name)} (${count})
      <span class="todo-group-del" data-action="delete-todo-group" data-group="${g.id}" title="删除分组">×</span>
    </button>`;
  }

  html += `<button class="todo-group-add" data-action="add-todo-group" title="添加分组">+</button>`;
  container.innerHTML = html;
}

export function renderTodo(): void {
  renderGroups();

  let undone = todos.filter(t => !t.done);
  let done = todos.filter(t => t.done);

  if (selectedGroup !== 'all') {
    undone = undone.filter(t => t.group === selectedGroup);
    done = done.filter(t => t.group === selectedGroup);
  }

  // 按优先级排序
  const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
  undone.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
  done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  // 更新统计
  const totalUndone = todos.filter(t => !t.done).length;
  const totalDone = todos.filter(t => t.done).length;
  const statsEl = document.getElementById('todoStats');
  if (statsEl) statsEl.textContent = `今日 ${totalDone}/${totalUndone + totalDone}`;

  // 渲染未完成
  const listEl = document.getElementById('todoList');
  if (listEl) {
    listEl.innerHTML = undone.length === 0
      ? '<div class="todo-empty">🎉 没有待办事项</div>'
      : undone.map(t => renderItem(t)).join('');
  }

  // 渲染已完成
  const doneListEl = document.getElementById('todoDoneList');
  if (doneListEl) {
    doneListEl.innerHTML = done.length === 0
      ? '<div class="todo-empty">暂无已完成</div>'
      : done.map(t => renderItem(t, true)).join('');
  }
}

function renderItem(todo: TodoItem, isDone = false): string {
  const priorityClass = `todo-priority-${todo.priority}`;
  const groupName = todoGroups.find(g => g.id === todo.group)?.name || '';

  let metaHtml = '';
  if (todo.link) {
    metaHtml += `<a href="${escapeHtml(todo.link)}" target="_blank" class="todo-link" title="${escapeHtml(todo.link)}">🔗</a>`;
  }
  if (todo.note) {
    metaHtml += `<span class="todo-note" title="${escapeHtml(todo.note)}">📌 ${escapeHtml(todo.note)}</span>`;
  }

  const groupTag = groupName ? `<span class="todo-tag todo-tag-group">${escapeHtml(groupName)}</span>` : '';

  return `
    <div class="todo-item ${isDone ? 'done' : ''} ${priorityClass}" data-id="${todo.id}" draggable="${!isDone}">
      <div class="todo-item-left">
        <button class="todo-check ${isDone ? 'checked' : ''}" data-action="toggle-todo" data-id="${todo.id}">
          ${isDone ? '✓' : ''}
        </button>
        <div class="todo-item-content">
          <span class="todo-item-title">${escapeHtml(todo.title)}</span>
          ${metaHtml ? `<div class="todo-item-meta">${metaHtml}</div>` : ''}
        </div>
      </div>
      <div class="todo-item-right">
        ${groupTag}
        <div class="todo-item-actions">
          <button class="todo-action-btn" data-action="edit-todo" data-id="${todo.id}" title="编辑">✏️</button>
          <button class="todo-action-btn" data-action="delete-todo" data-id="${todo.id}" title="删除">🗑️</button>
        </div>
      </div>
    </div>
  `;
}
