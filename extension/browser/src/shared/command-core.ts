/**
 * 命令面板核心逻辑（共享模块）
 * 被 newtab/command.ts 和 command.ts (iframe) 共同使用
 */
// @ts-nocheck

export interface CommandItem {
  type: string;
  icon: string;
  title: string;
  desc: string;
  action: () => void;
}

export interface CommandPaletteOptions {
  /** 获取所有命令项 */
  getItems: () => Promise<CommandItem[]> | CommandItem[];
  /** 面板容器 ID */
  overlayId: string;
  /** 输入框 ID */
  inputId: string;
  /** 列表容器 ID */
  listId: string;
}

let visible = false;
let items: CommandItem[] = [];
let filtered: CommandItem[] = [];
let selectedIndex = 0;
let options: CommandPaletteOptions;

export function initCommandCore(opts: CommandPaletteOptions): void {
  options = opts;

  // 点击遮罩关闭
  const overlay = document.getElementById(opts.overlayId);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });

  // 输入事件
  const input = document.getElementById(opts.inputId);
  input?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    filter(query);
    renderList();
  });
  input?.addEventListener('keydown', handleKeydown);

  // 列表点击
  document.getElementById(opts.listId)?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('[data-index]') as HTMLElement | null;
    if (item) {
      selectedIndex = parseInt(item.dataset.index || '0');
      executeSelected();
    }
  });
}

export async function show(): Promise<void> {
  items = await options.getItems();
  filter('');
  visible = true;

  const overlay = document.getElementById(options.overlayId);
  if (overlay) overlay.style.display = 'flex';

  const input = document.getElementById(options.inputId) as HTMLInputElement;
  if (input) {
    input.value = '';
    input.focus();
  }

  renderList();
}

export function hide(): void {
  visible = false;
  const overlay = document.getElementById(options.overlayId);
  if (overlay) overlay.style.display = 'none';
}

export function isVisible(): boolean {
  return visible;
}

function filter(query: string): void {
  if (!query) {
    filtered = items.slice(0, 12);
  } else {
    const lower = query.toLowerCase();
    filtered = items.filter(item =>
      item.title.toLowerCase().includes(lower) ||
      item.desc.toLowerCase().includes(lower)
    ).slice(0, 12);
  }
  selectedIndex = 0;
}

function renderList(): void {
  const container = document.getElementById(options.listId);
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="command-empty">没有匹配的命令</div>';
    return;
  }

  container.innerHTML = filtered.map((item, idx) => `
    <div class="command-item ${idx === selectedIndex ? 'selected' : ''}" data-index="${idx}">
      <span class="command-item-icon">${item.icon}</span>
      <div class="command-item-info">
        <span class="command-item-title">${escapeHtml(item.title)}</span>
        ${item.desc ? `<span class="command-item-desc">${escapeHtml(item.desc)}</span>` : ''}
      </div>
      <span class="command-item-type">${getTypeLabel(item.type)}</span>
    </div>
  `).join('');

  const selected = container.querySelector('.command-item.selected');
  selected?.scrollIntoView({ block: 'nearest' });
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'page': return '页面';
    case 'tool': return '工具';
    case 'bookmark': return '书签';
    case 'site': return '网站';
    case 'server': return '服务器';
    default: return '';
  }
}

function handleKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
      renderList();
      break;
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderList();
      break;
    case 'Enter':
      e.preventDefault();
      executeSelected();
      break;
    case 'Escape':
      e.preventDefault();
      hide();
      break;
  }
}

function executeSelected(): void {
  const item = filtered[selectedIndex];
  if (item) {
    hide();
    item.action();
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
