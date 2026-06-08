/**
 * 命令面板数据构建（共享）
 * 构建统一的命令列表，供 newtab 和 iframe 命令面板使用
 */
// @ts-nocheck

import type { CommandItem } from './command-core';

export interface CommandItemsOptions {
  /** 切换页面的回调 */
  switchPage?: (page: string) => void;
  /** 打开 URL 的回调 */
  openUrl?: (url: string) => void;
  /** 网站分类数据 */
  siteCategories?: Array<{ sites: Array<{ name: string; url: string }> }>;
  /** 获取书签树 */
  getBookmarks?: () => any[] | null;
}

export function buildCommandItems(opts: CommandItemsOptions): CommandItem[] {
  const { switchPage, openUrl, siteCategories, getBookmarks } = opts;
  const doOpen = openUrl || ((url) => window.open(url, '_blank'));
  const doSwitch = switchPage || (() => {});

  const items: CommandItem[] = [];

  // 内置页面命令
  items.push(
    { type: 'page', icon: '🌐', title: '常用网站', desc: '切换到常用网站页面', action: () => doSwitch('sites') },
    { type: 'page', icon: '📁', title: '我的书签', desc: '切换到书签管理页面', action: () => doSwitch('bookmarks') },
    { type: 'page', icon: '🛠️', title: '实用工具', desc: '切换到工具页面', action: () => doSwitch('tools') },
    { type: 'page', icon: '📝', title: '待办事项', desc: '切换到待办页面', action: () => doSwitch('todo') },
    { type: 'page', icon: '💻', title: '终端', desc: '切换到终端页面', action: () => doSwitch('terminal') },
  );

  // 工具命令
  const tools = [
    { icon: '{}', title: 'JSON 格式化' },
    { icon: '⏰', title: '时间戳转换' },
    { icon: '📋', title: 'Cron 表达式' },
    { icon: '.*', title: '正则表达式' },
    { icon: '🔗', title: 'URL 编解码' },
    { icon: '01', title: 'Base64 编解码' },
    { icon: '🔑', title: 'JWT 解析' },
    { icon: '#', title: 'MD5/SHA 哈希' },
    { icon: '⇄', title: 'Diff 对比' },
  ];
  for (const t of tools) {
    items.push({ type: 'tool', icon: t.icon, title: t.title, desc: `打开${t.title}工具`, action: () => doSwitch('tools') });
  }

  // 常用网站
  if (siteCategories) {
    for (const cat of siteCategories) {
      for (const site of cat.sites) {
        items.push({ type: 'site', icon: '🌐', title: site.name, desc: site.url, action: () => doOpen(site.url) });
      }
    }
  }

  // 书签
  if (getBookmarks) {
    const tree = getBookmarks();
    if (tree) {
      function collectBookmarks(nodes) {
        if (!nodes) return;
        for (const node of nodes) {
          if (node.url) {
            items.push({ type: 'bookmark', icon: '📄', title: node.title || node.url, desc: node.url, action: () => doOpen(node.url) });
          }
          if (node.children) collectBookmarks(node.children);
        }
      }
      collectBookmarks(tree);
    }
  }

  // 服务器
  try {
    const servers = JSON.parse(localStorage.getItem('linkhub-servers') || '[]');
    for (const s of servers) {
      items.push({
        type: 'server',
        icon: '💻',
        title: s.name,
        desc: `${s.username || ''}@${s.host || s.wsUrl || ''}`,
        action: () => doSwitch('terminal')
      });
    }
  } catch (e) {
    // ignore
  }

  return items;
}
