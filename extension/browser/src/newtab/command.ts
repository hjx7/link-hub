/**
 * LinkHub - 快捷命令面板
 * Alt+K 唤起，支持快速跳转书签、切换页面、执行操作
 */

import { escapeHtml } from './utils';
import { devSiteCategories } from './data';

// ===== 类型 =====

interface CommandItem {
  type: string;
  icon: string;
  title: string;
  desc: string;
  action: () => void;
}

type SwitchPageFn = (page: string) => void;

// ===== 状态 =====

let visible = false;
let items: CommandItem[] = [];
let filtered: CommandItem[] = [];
let selectedIndex = 0;
let switchPageFn: SwitchPageFn = () => {};

// ===== 公共 API =====

export function initCommandPalette(switchPage: SwitchPageFn): void {
  switchPageFn = switchPage;

  // Alt+K 快捷键
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'k') {
      e.preventDefault();
      visible ? hide() : show();
    }
  });

  // 点击遮罩关闭
  const overlay = document.getElementById('commandPalette');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) hide();
  });

  // 输入事件
  const input = document.getElementById('commandInput') as HTMLInputElement | null;
  input?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    filter(query);
    renderList();
  });
  input?.addEventListener('keydown', handleKeydown);

  // 列表点击
  document.getElementById('commandList')?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.command-item') as HTMLElement | null;
    if (item) {
      selectedIndex = parseInt(item.dataset.index || '0');
      executeSelected();
    }
  });
}

export function show(): void {
  buildItems();
  filter('');
  visible = true;

  const overlay = document.getElementById('commandPalette')!;
  overlay.style.display = 'flex';

  const input = document.getElementById('commandInput') as HTMLInputElement;
  input.value = '';
  input.focus();

  renderList();
}

export function hide(): void {
  visible = false;
  document.getElementById('commandPalette')!.style.display = 'none';
}

// ===== 内部逻辑 =====

function buildItems(): void {
  items = [
    ...getBuiltinCommands(),
    ...getSiteCommands(),
    ...getServerCommands()
  ];
}

function getBuiltinCommands(): CommandItem[] {
  return [
    { type: 'page', icon: '🌐', title: '常用网站', desc: '切换到常用网站页面', action: () => switchPageFn('sites') },
    { type: 'page', icon: '📁', title: '我的书签', desc: '切换到书签管理页面', action: () => switchPageFn('bookmarks') },
    { type: 'page', icon: '🛠️', title: '实用工具', desc: '切换到工具页面', action: () => switchPageFn('tools') },
    { type: 'page', icon: '📝', title: '待办事项', desc: '切换到待办页面', action: () => switchPageFn('todo') },
    { type: 'page', icon: '💻', title: '终端', desc: '切换到终端页面', action: () => switchPageFn('terminal') },
    { type: 'tool', icon: '{}', title: 'JSON 格式化', desc: '打开 JSON 工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '⏰', title: '时间戳转换', desc: '打开时间戳工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '📋', title: 'Cron 表达式', desc: '打开 Cron 解析工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '.*', title: '正则表达式', desc: '打开正则测试工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '🔗', title: 'URL 编解码', desc: '打开 URL 工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '01', title: 'Base64 编解码', desc: '打开 Base64 工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '🔑', title: 'JWT 解析', desc: '打开 JWT 解析工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '#', title: 'MD5/SHA 哈希', desc: '打开哈希计算工具', action: () => switchPageFn('tools') },
    { type: 'tool', icon: '⇄', title: 'Diff 对比', desc: '打开文本对比工具', action: () => switchPageFn('tools') },
  ];
}

function getSiteCommands(): CommandItem[] {
  const commands: CommandItem[] = [];
  for (const cat of devSiteCategories) {
    for (const site of cat.sites) {
      commands.push({
        type: 'site',
        icon: '🌐',
        title: site.name,
        desc: site.url,
        action: () => window.open(site.url, '_blank')
      });
    }
  }
  return commands;
}

function getServerCommands(): CommandItem[] {
  const commands: CommandItem[] = [];
  try {
    const servers = JSON.parse(localStorage.getItem('linkhub-servers') || '[]');
    for (const s of servers) {
      commands.push({
        type: 'server',
        icon: '💻',
        title: s.name,
        desc: `${s.username || ''}@${s.host || s.wsUrl || ''}`,
        action: () => {
          switchPageFn('terminal');
        }
      });
    }
  } catch (e) {
    console.warn('[command] Failed to load servers:', e);
  }
  return commands;
}

function filter(query: string): void {
  if (!query) {
    filtered = items.slice(0, 10);
  } else {
    const lower = query.toLowerCase();
    filtered = items.filter(item =>
      item.title.toLowerCase().includes(lower) ||
      item.desc.toLowerCase().includes(lower)
    ).slice(0, 10);
  }
  selectedIndex = 0;
}

function renderList(): void {
  const container = document.getElementById('commandList');
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
