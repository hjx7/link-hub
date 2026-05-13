/**
 * LinkHub New Tab - 常用网站模块
 */

// 渲染常用网站页面
function renderSites() {
  const container = document.getElementById('sitesGrid');
  const { escapeHtml, getDomain } = window.LinkHubUtils;
  const { devSiteCategories } = window.LinkHubData;
  
  container.innerHTML = devSiteCategories.map(cat => `
    <div class="site-category">
      <h3 class="category-title">
        <span class="category-icon">${cat.icon}</span>
        ${cat.name}
      </h3>
      <div class="category-grid">
        ${cat.sites.map(site => `
          <a href="${escapeHtml(site.url)}" class="site-card" target="_blank" title="${escapeHtml(site.name)}">
            <div class="site-icon">
              ${(() => {
                if (site.favicon) {
                  return `<img src="${escapeHtml(site.favicon)}" class="favicon-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                     <span class="favicon-fallback" style="display:none">${escapeHtml(site.name[0])}</span>`;
                }
                return `<span>${escapeHtml(site.name[0])}</span>`;
              })()}
            </div>
            <span class="site-name">${escapeHtml(site.name)}</span>
            <span class="site-domain">${getDomain(site.url)}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// 暴露到全局
window.LinkHubSites = {
  renderSites
};
