/**
 * LinkHub Extension - Background Service Worker
 * 处理Chrome书签的CRUD操作和跨组件通信
 */

// 浏览器默认文件夹名称映射（不同浏览器的不同命名）
// 各浏览器可能的默认文件夹名称（不区分大小写）
const KNOWN_DEFAULT_FOLDERS = new Set([
  // 中文
  '书签栏', '其他书签', '收藏夹栏', '其他收藏夹', '书签', '其他',
  // 英文
  'bookmarks bar', 'other bookmarks', 'favorites bar', 'other favorites',
  'bookmarks', 'other', 'favorites',
  // 西班牙语
  'barra de favoritos', 'otros marcadores',
  // 德语
  'lesezeichenleiste', 'andere lesezeichen',
  // 俄语
  'избранное', 'другие закладки', 'панель закладок'
]);

// 检测文件夹是否为浏览器默认文件夹，返回 '1'(书签栏) 或 '2'(其他书签) 或 null
function detectDefaultFolderType(title) {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  
  // 中文关键词匹配
  if (title.includes('栏') && (title.includes('书签') || title.includes('收藏'))) {
    return '1'; // 书签栏
  }
  if (title.includes('书签') || title.includes('收藏')) {
    return '2'; // 其他书签
  }
  
  // 英文关键词匹配 - favorites
  if (lowerTitle.includes('favorites') || lowerTitle.includes('favourites')) {
    if (lowerTitle.includes('bar')) {
      return '1'; // Favorites Bar / 收藏夹栏
    }
    return '2'; // Other Favorites / 其他收藏夹
  }
  
  // 英文关键词匹配 - bookmarks
  if (lowerTitle.includes('bookmarks')) {
    if (lowerTitle.includes('bar')) {
      return '1'; // Bookmarks Bar / 书签栏
    }
    return '2'; // Other Bookmarks / 其他书签
  }
  
  // 其他语言关键词匹配
  if (lowerTitle.includes('bar') || lowerTitle.includes('leiste')) {
    return '1';
  }
  
  return null;
}

// 消息处理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handlers = {
    // 打开 LinkHub 页面（从命令面板调用）
    async openLinkHub(data) {
      const page = data || 'sites';
      await chrome.tabs.create({ url: chrome.runtime.getURL(`newtab/index.html#${page}`) });
      return true;
    },

    // 获取Chrome原生书签树
    async getBookmarkTree() {
      return await chrome.bookmarks.getTree();
    },
    
    // 添加书签到Chrome
    async addChromeBookmark(data) {
      let parentId = '1';
      if (data.parentId) {
        parentId = data.parentId;
      } else {
        const tree = await chrome.bookmarks.getTree();
        parentId = tree[0].id;
      }
      return await chrome.bookmarks.create({
        title: data.title,
        url: data.url,
        parentId: parentId
      });
    },
    
    // 从Chrome删除书签
    async deleteChromeBookmark(data) {
      const id = typeof data === 'object' ? data.id : data;
      if (!id) throw new Error('书签ID不能为空');
      return new Promise((resolve, reject) => {
        chrome.bookmarks.remove(String(id), function() {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(true);
          }
        });
      });
    },
    
    // 从Chrome删除书签树（文件夹）
    async deleteChromeBookmarkTree(data) {
      const id = typeof data === 'object' ? data.id : data;
      if (!id) throw new Error('文件夹ID不能为空');
      return new Promise((resolve, reject) => {
        chrome.bookmarks.removeTree(String(id), function() {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(true);
          }
        });
      });
    },
    
    // 更新Chrome书签
    async updateChromeBookmark(data) {
      const { id, title, url, parentId } = data;
      
      const bookmarkList = await chrome.bookmarks.get(id);
      if (!bookmarkList || bookmarkList.length === 0) {
        throw new Error('书签不存在');
      }
      const bookmark = bookmarkList[0];
      
      if (parentId && bookmark.parentId !== parentId) {
        await chrome.bookmarks.move(id, { parentId });
      }
      
      const currentList = await chrome.bookmarks.get(id);
      const current = currentList[0];
      
      if (current.url) {
        await chrome.bookmarks.update(id, { title, url });
      } else {
        await chrome.bookmarks.update(id, { title });
      }
      
      return true;
    },
    
    // 创建Chrome文件夹
    async addChromeFolder(data) {
      const parentId = data.parentId || '1';
      return await chrome.bookmarks.create({
        title: data.title,
        parentId: parentId
      });
    },
    
    // 批量导入书签（合并模式）
    async batchImportBookmarks(data) {
      let { bookmarks, mode } = data;
      const results = { folders: 0, bookmarks: 0 };
      
      // Chrome 书签栏和其他书签的根 ID
      const CHROME_BOOKMARK_BAR_ID = '1';
      const CHROME_OTHER_BOOKMARKS_ID = '2';
      
      // 生成书签的唯一标识（用于去重）
      function getBookmarkKey(node) {
        return `${node.title}|||${node.url}`.toLowerCase();
      }
      
      // 预处理：处理空标题根节点和多余包装层
      function flattenRootNodes(nodes) {
        if (nodes.length === 1 && !nodes[0].url && !nodes[0].title && nodes[0].children) {
          return flattenRootNodes(nodes[0].children);
        }
        
        const result = [];
        for (const node of nodes) {
          if (!node.url && node.children && node.children.length > 0) {
            const defaultType = detectDefaultFolderType(node.title);
            if (!defaultType) {
              const hasDefaultChild = node.children.some(child => 
                detectDefaultFolderType(child.title)
              );
              if (hasDefaultChild) {
                result.push(...flattenRootNodes(node.children));
                continue;
              }
            }
          }
          result.push(node);
        }
        return result;
      }
      
      // 合并同级别相同名称的文件夹
      function mergeSameNameFolders(nodes) {
        const folderMap = new Map();
        const result = [];
        
        for (const node of nodes) {
          if (!node.url && node.children) {
            const key = node.title.toLowerCase();
            if (folderMap.has(key)) {
              const existing = folderMap.get(key);
              
              function collectBookmarkKeys(children, keys) {
                for (const child of children) {
                  if (child.url) {
                    keys.add(getBookmarkKey(child));
                  } else if (child.children) {
                    collectBookmarkKeys(child.children, keys);
                  }
                }
              }
              const existingKeys = new Set();
              collectBookmarkKeys(existing.children, existingKeys);
              
              function mergeChildren(targetChildren, sourceChildren) {
                for (const source of sourceChildren) {
                  if (source.url) {
                    if (!existingKeys.has(getBookmarkKey(source))) {
                      targetChildren.push(source);
                      existingKeys.add(getBookmarkKey(source));
                    }
                  } else if (source.children) {
                    const subKey = source.title.toLowerCase();
                    const existingSub = targetChildren.find(
                      c => !c.url && c.title.toLowerCase() === subKey
                    );
                    if (existingSub) {
                      mergeChildren(existingSub.children, source.children);
                    } else {
                      targetChildren.push({ ...source, children: [...source.children] });
                    }
                  }
                }
              }
              
              mergeChildren(existing.children, node.children);
            } else {
              folderMap.set(key, { ...node, children: [...node.children] });
              result.push(folderMap.get(key));
            }
          } else {
            result.push(node);
          }
        }
        
        return result;
      }
      
      // 将导入数据与 Chrome 已有书签合并
      async function mergeWithChrome(importNodes, chromeParentId) {
        // 递归导入并合并
        async function importAndMerge(nodes, targetParentId) {
          for (const node of nodes) {
            if (node.url) {
              // 是书签：去重后添加
              const key = getBookmarkKey(node);
              const chromeChildren = await chrome.bookmarks.getChildren(targetParentId);
              const exists = chromeChildren.some(c => c.url && getBookmarkKey({ title: c.title, url: c.url }) === key);
              if (!exists) {
                await chrome.bookmarks.create({
                  title: node.title,
                  url: node.url,
                  parentId: targetParentId
                });
                results.bookmarks++;
              }
            } else if (node.children && node.children.length > 0) {
              // 是文件夹
              const folderKey = node.title.toLowerCase();
              const chromeChildren = await chrome.bookmarks.getChildren(targetParentId);
              
              // 检查 Chrome 是否有同名文件夹
              const existingFolder = chromeChildren.find(c => !c.url && c.title.toLowerCase() === folderKey);
              
              if (existingFolder) {
                // Chrome 已有此文件夹 - 递归合并内容
                await importAndMerge(node.children, existingFolder.id);
              } else {
                // Chrome 没有此文件夹 - 创建新文件夹
                const newFolder = await chrome.bookmarks.create({
                  title: node.title,
                  parentId: targetParentId
                });
                results.folders++;
                await importAndMerge(node.children, newFolder.id);
              }
            }
          }
        }
        
        await importAndMerge(importNodes, chromeParentId);
      }
      
      // 递归创建节点（用于非合并场景）
      async function createNode(node, parentId) {
        if (node.url) {
          await chrome.bookmarks.create({
            title: node.title,
            url: node.url,
            parentId: parentId
          });
          results.bookmarks++;
        } else {
          const folder = await chrome.bookmarks.create({
            title: node.title,
            parentId: parentId
          });
          results.folders++;
          
          if (node.children && node.children.length > 0) {
            const mergedChildren = mergeSameNameFolders(node.children);
            for (const child of mergedChildren) {
              await createNode(child, folder.id);
            }
          }
        }
      }
      
      // 应用预处理
      bookmarks = flattenRootNodes(bookmarks);
      bookmarks = mergeSameNameFolders(bookmarks);
      
      // 按类型分组
      const bookmarkBarItems = [];
      const otherItems = [];
      const customItems = [];
      
      for (const node of bookmarks) {
        if (node.children && node.children.length > 0) {
          const defaultFolderType = detectDefaultFolderType(node.title);
          if (defaultFolderType === '1') {
            bookmarkBarItems.push(...node.children);
          } else if (defaultFolderType === '2') {
            otherItems.push(...node.children);
          } else {
            customItems.push(node);
          }
        } else if (node.url) {
          otherItems.push(node);
        }
      }
      
      // 判断是否为覆盖模式
      const isReplaceMode = mode === 'replace';
      
      if (isReplaceMode) {
        // 覆盖模式：直接创建节点，不合并
        for (const node of bookmarkBarItems) {
          await createNode(node, CHROME_BOOKMARK_BAR_ID);
        }
        for (const node of otherItems) {
          await createNode(node, CHROME_OTHER_BOOKMARKS_ID);
        }
        for (const node of customItems) {
          await createNode(node, CHROME_OTHER_BOOKMARKS_ID);
        }
      } else {
        // 合并模式：与 Chrome 已有书签合并
        if (bookmarkBarItems.length > 0) {
          await mergeWithChrome(bookmarkBarItems, CHROME_BOOKMARK_BAR_ID);
        }
        if (otherItems.length > 0) {
          await mergeWithChrome(otherItems, CHROME_OTHER_BOOKMARKS_ID);
        }
        for (const node of customItems) {
          await createNode(node, CHROME_OTHER_BOOKMARKS_ID);
        }
      }
      
      return results;
    },
    
    // 批量删除书签（覆盖模式用）
    async batchDeleteBookmarks(data) {
      const { folderId } = data;
      const results = { folders: 0, bookmarks: 0 };
      
      // 删除节点
      async function deleteNode(node) {
        if (node.url) {
          // 是书签
          await chrome.bookmarks.remove(node.id);
          results.bookmarks++;
        } else {
          // 是文件夹 - removeTree 会递归删除所有子节点
          await chrome.bookmarks.removeTree(node.id);
          results.folders++;
        }
      }
      
      // 获取文件夹下的所有直接子节点并删除
      const children = await chrome.bookmarks.getChildren(folderId);
      for (const child of children) {
        await deleteNode(child);
      }
      
      return results;
    },
    
    // 移动书签/文件夹
    async moveBookmark(data) {
      const { id, parentId, index } = data;
      return new Promise((resolve, reject) => {
        try {
          // 允许 index 为 undefined（仅切换父文件夹时）
          const dest = index !== undefined ? { parentId, index } : { parentId };
          chrome.bookmarks.move(id, dest, (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        } catch (e) {
          reject(e);
        }
      });
    },
    
    // 获取 favicon URL（直接返回原始 URL，让 img 标签加载）
    async fetchFavicon(data) {
      const { url } = data;
      return url;
    },

    // 获取最佳 favicon（先解析 HTML 查找自定义图标，回退到 favicon.ico）
    async fetchBestFavicon(data) {
      const { url } = data;
      try {
        // 第一步：解析 HTML 查找自定义图标
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors'
        });
        
        if (response.ok) {
          const htmlText = await response.text();
          
          // 解析 HTML 查找 link 标签
          const iconRels = ['apple-touch-icon', 'icon', 'shortcut icon', 'mask-icon'];
          let bestIconUrl = null;
          
          for (const rel of iconRels) {
            // 使用正则匹配（避免 DOMParser 解析问题）
            const pattern = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i');
            const match = htmlText.match(pattern);
            
            if (match) {
              const hrefMatch = match[0].match(/href=["']([^"']+)["']/);
              if (hrefMatch && hrefMatch[1]) {
                bestIconUrl = hrefMatch[1];
                break;
              }
            }
          }
          
          // 如果找到自定义图标，转换为绝对路径
          if (bestIconUrl) {
            return new URL(bestIconUrl, url).href;
          }
        }
      } catch (e) {
        // fetch 失败，继续使用回退方案
      }
      
      // 第二步：回退到默认的 /favicon.ico
      return new URL('/favicon.ico', url).href;
    }
  };
  
  const handler = handlers[request.action];
  if (handler) {
    handler(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// 监听书签变化，通知所有标签页
try {
  const notifyTabs = (type, id, info) => {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'bookmarkChanged',
            action: type,
            id: id,
            info: info
          }).catch(() => {});
        }
      });
    });
  };

  chrome.bookmarks.onCreated?.addListener((id, bookmark) => notifyTabs('created', id, bookmark));
  chrome.bookmarks.onRemoved?.addListener((id, info) => notifyTabs('removed', id, info));
  chrome.bookmarks.onChanged?.addListener((id, info) => notifyTabs('changed', id, info));
  chrome.bookmarks.onMoved?.addListener((id, info) => notifyTabs('moved', id, info));
  chrome.bookmarks.onCopied?.addListener((id, info) => notifyTabs('copied', id, info));
} catch (err) {}

// 点击插件图标时打开新标签页
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab/index.html') });
});

// 浏览器启动时自动打开 LinkHub 标签页
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('newtab/index.html') });
});

