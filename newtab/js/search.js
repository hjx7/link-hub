/**
 * LinkHub New Tab - 搜索模块
 */

// 执行主搜索
async function performMainSearch() {
  const { sendMessage } = window.LinkHubUtils;
  const query = document.getElementById('mainSearchInput').value.trim();
  if (!query) return;
  searchByTag(query);
}

// 按标签搜索
async function searchByTag(tag) {
  const { sendMessage } = window.LinkHubUtils;
  const results = await sendMessage({ action: 'searchBookmarks', data: tag });
  renderSearchResults(results.data || []);
}

// 渲染搜索结果
function renderSearchResults(results) {
  const { escapeHtml } = window.LinkHubUtils;
  const container = document.getElementById('searchResults');
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">没有找到相关书签</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = results.map(bm => `
    <a href="${escapeHtml(bm.url)}" class="result-item" target="_blank">
      <div class="result-icon">
        ${bm.favicon 
          ? `<img src="${escapeHtml(bm.favicon)}" class="favicon-img" data-fallback="${escapeHtml(bm.title[0])}">` 
          : `<span class="favicon-text">${escapeHtml(bm.title[0])}</span>`}
      </div>
      <div class="result-info">
        <div class="result-title">${escapeHtml(bm.title)}</div>
        <div class="result-url">${escapeHtml(bm.url)}</div>
        <div class="result-desc">${escapeHtml(bm.category)}</div>
      </div>
    </a>
  `).join('');
}

// 暴露到全局
window.LinkHubSearch = {
  performMainSearch,
  searchByTag,
  renderSearchResults
};
