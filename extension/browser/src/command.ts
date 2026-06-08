/**
 * LinkHub - 全局命令面板（iframe 内运行）
 * 通过 chrome.bookmarks API 获取书签，通过 postMessage 与父页面通信
 * 复用共享命令核心
 */
// @ts-nocheck

import { initCommandCore, show, hide } from './shared/command-core';
import { buildCommandItems } from './shared/command-items';

// 获取网站数据（通过 index.html 中的 <script src="../newtab/js/data.js"> 已挂载到 window.LinkHubData）
function getSiteCategories() {
  return window.LinkHubData?.devSiteCategories || [];
}

// 获取书签
async function loadBookmarkTree() {
  try {
    return await chrome.bookmarks.getTree();
  } catch (e) {
    return null;
  }
}

// 初始化
async function init() {
  initCommandCore({
    overlayId: 'overlay',
    inputId: 'input',
    listId: 'list',
    getItems: async () => {
      const tree = await loadBookmarkTree();
      return buildCommandItems({
        switchPage: (page) => {
          window.parent.postMessage({ type: 'linkhub-open-tab', page }, '*');
        },
        openUrl: (url) => {
          window.parent.postMessage({ type: 'linkhub-open-url', url }, '*');
        },
        siteCategories: getSiteCategories(),
        getBookmarks: () => tree
      });
    }
  });

  // 自动打开
  await show();

  // 监听父页面消息（获取焦点）
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'linkhub-focus') {
      document.getElementById('input')?.focus();
    }
  });
}

init();
