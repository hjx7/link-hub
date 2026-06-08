/**
 * LinkHub - 常用网站模块
 */

import { escapeHtml, getDomain } from './utils';
import { devSiteCategories } from './data';

export function renderSites(): void {
  const container = document.getElementById('sitesGrid');
  if (!container) return;

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
              ${site.favicon
                ? `<img src="${escapeHtml(site.favicon)}" class="favicon-img" data-fallback="${escapeHtml(site.name[0])}">
                   <span class="favicon-fallback" style="display:none">${escapeHtml(site.name[0])}</span>`
                : `<span>${escapeHtml(site.name[0])}</span>`
              }
            </div>
            <span class="site-name">${escapeHtml(site.name)}</span>
            <span class="site-domain">${getDomain(site.url)}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');

  // 图片加载失败时回退到首字（替代内联 onerror）
  container.addEventListener('error', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList?.contains('favicon-img')) {
      target.style.display = 'none';
      const fallback = target.nextElementSibling as HTMLElement | null;
      if (fallback) fallback.style.display = 'flex';
    }
  }, true); // 捕获阶段
}
