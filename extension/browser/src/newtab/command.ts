/**
 * LinkHub - 页面内命令面板（newtab 版本）
 * Alt+K 唤起，复用共享命令核心
 */

import { initCommandCore, show, hide, isVisible } from '../shared/command-core';
import { buildCommandItems } from '../shared/command-items';
import { devSiteCategories } from './data';
import { getBookmarkTree, loadChromeBookmarkTree } from './bookmarks';

type SwitchPageFn = (page: string) => void;

let switchPageFn: SwitchPageFn = () => {};

export function initCommandPalette(switchPage: SwitchPageFn): void {
  switchPageFn = switchPage;

  initCommandCore({
    overlayId: 'commandPalette',
    inputId: 'commandInput',
    listId: 'commandList',
    getItems: async () => {
      // 确保书签已加载
      if (!getBookmarkTree()) {
        await loadChromeBookmarkTree();
      }
      return buildCommandItems({
        switchPage: switchPageFn,
        openUrl: (url) => window.open(url, '_blank'),
        siteCategories: devSiteCategories,
        getBookmarks: getBookmarkTree
      });
    }
  });

  // Alt+K 快捷键
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'k') {
      e.preventDefault();
      isVisible() ? hide() : show();
    }
  });
}

export { show, hide };
