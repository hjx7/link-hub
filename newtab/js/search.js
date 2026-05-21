/**
 * LinkHub New Tab - 搜索模块
 * 支持百度/Bing/Google 搜索，在当前页面展示结果列表
 */

// 当前搜索引擎
let _currentEngine = 'baidu';

// 搜索引擎配置
const ENGINES = {
  baidu: {
    name: '百度',
    icon: '🅱',
    searchUrl: 'https://www.baidu.com/s?wd=',
    // 百度结果解析
    parse(html) {
      const results = [];
      // 匹配百度搜索结果容器
      const resultPattern = /<div[^>]*class="[^"]*c-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*c-container|<div id="page"|$)/g;
      let match;

      while ((match = resultPattern.exec(html)) !== null) {
        const block = match[1];

        // 提取标题和链接
        const titleMatch = block.match(/<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/);
        if (!titleMatch) continue;

        const url = titleMatch[1];
        const title = titleMatch[2].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();

        // 提取摘要
        let desc = '';
        const descMatch = block.match(/<span[^>]*class="content-right_[^"]*"[^>]*>([\s\S]*?)<\/span>/);
        if (descMatch) {
          desc = descMatch[1].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
        }
        if (!desc) {
          const descMatch2 = block.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/);
          if (descMatch2) {
            desc = descMatch2[1].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
          }
        }

        if (title && url) {
          results.push({ title, url, desc });
        }
      }

      return results;
    }
  },
  bing: {
    name: 'Bing',
    icon: 'Ⓑ',
    searchUrl: 'https://www.bing.com/search?q=',
    parse(html) {
      const results = [];
      // Bing 结果在 <li class="b_algo"> 中
      const resultPattern = /<li class="b_algo">([\s\S]*?)<\/li>/g;
      let match;

      while ((match = resultPattern.exec(html)) !== null) {
        const block = match[1];

        // 提取标题和链接
        const titleMatch = block.match(/<h2>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/);
        if (!titleMatch) continue;

        const url = titleMatch[1];
        const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();

        // 提取摘要
        let desc = '';
        const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
        if (descMatch) {
          desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        if (title && url) {
          results.push({ title, url, desc });
        }
      }

      return results;
    }
  },
  google: {
    name: 'Google',
    icon: '🇬',
    searchUrl: 'https://www.google.com/search?q=',
    parse(html) {
      const results = [];
      // Google 结果在 <div class="g"> 中
      const resultPattern = /<div class="g">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
      let match;

      while ((match = resultPattern.exec(html)) !== null) {
        const block = match[1];

        // 提取链接和标题
        const linkMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
        if (!linkMatch) continue;

        const url = linkMatch[1];
        const titleBlock = linkMatch[2];
        const titleMatch = titleBlock.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
        const title = titleMatch
          ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
          : titleBlock.replace(/<[^>]+>/g, '').trim();

        // 提取摘要
        let desc = '';
        const descMatch = block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (descMatch) {
          desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
        }

        if (title && url && !url.includes('google.com/search')) {
          results.push({ title, url, desc });
        }
      }

      return results;
    }
  }
};

// 执行搜索
async function performMainSearch() {
  const query = document.getElementById('mainSearchInput').value.trim();
  if (!query) return;

  const container = document.getElementById('searchResults');
  container.innerHTML = '<div class="search-loading"><span class="loading-spinner"></span> 搜索中...</div>';

  try {
    const engine = ENGINES[_currentEngine];
    const searchUrl = engine.searchUrl + encodeURIComponent(query);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    const html = await response.text();
    const results = engine.parse(html);

    if (results.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">未找到相关结果</div>
          <a href="${searchUrl}" target="_blank" class="search-fallback-link">在 ${engine.name} 中查看</a>
        </div>
      `;
      return;
    }

    renderSearchResults(results, searchUrl, engine.name);
  } catch (err) {
    // 搜索失败时提供跳转链接
    const engine = ENGINES[_currentEngine];
    const searchUrl = engine.searchUrl + encodeURIComponent(query);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">搜索出错: ${err.message}</div>
        <a href="${searchUrl}" target="_blank" class="search-fallback-link">前往 ${engine.name} 搜索</a>
      </div>
    `;
  }
}

// 渲染搜索结果
function renderSearchResults(results, searchUrl, engineName) {
  const { escapeHtml } = window.LinkHubUtils;
  const container = document.getElementById('searchResults');

  let html = '<div class="search-result-list">';

  for (const item of results) {
    const displayUrl = item.url.length > 80 ? item.url.slice(0, 80) + '...' : item.url;
    html += `
      <a href="${escapeHtml(item.url)}" class="result-item" target="_blank">
        <div class="result-info">
          <div class="result-title">${escapeHtml(item.title)}</div>
          <div class="result-url">${escapeHtml(displayUrl)}</div>
          ${item.desc ? `<div class="result-desc">${escapeHtml(item.desc)}</div>` : ''}
        </div>
      </a>
    `;
  }

  html += '</div>';
  html += `<div class="search-more"><a href="${searchUrl}" target="_blank">在 ${engineName} 中查看更多结果 →</a></div>`;

  container.innerHTML = html;
}

// 切换搜索引擎下拉
function toggleEngineDropdown() {
  const dropdown = document.getElementById('engineDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// 选择搜索引擎
function selectEngine(engine) {
  _currentEngine = engine;
  const engineConfig = ENGINES[engine];

  // 更新按钮图标
  document.getElementById('engineIcon').textContent = engineConfig.icon;

  // 更新 placeholder
  document.getElementById('mainSearchInput').placeholder = `使用${engineConfig.name}搜索...`;

  // 更新选中状态
  document.querySelectorAll('.engine-option').forEach(el => {
    el.classList.toggle('active', el.dataset.engine === engine);
  });

  // 关闭下拉
  document.getElementById('engineDropdown').style.display = 'none';
}

// 暴露到全局
window.LinkHubSearch = {
  performMainSearch,
  toggleEngineDropdown,
  selectEngine
};
