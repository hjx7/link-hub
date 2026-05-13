/**
 * LinkHub New Tab - 工具函数模块
 */

// HTML 转义
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 获取域名
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// URL 验证
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// RGB 转 HSL
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

// 生成 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 发送消息到 background
function sendMessage(request) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(request, function(response) {
        if (chrome.runtime.lastError) {
          // 如果是端口关闭错误，尝试重试一次
          if (chrome.runtime.lastError.message?.includes('port closed')) {
            // 使用新的 Promise 来处理重试
            chrome.runtime.sendMessage(request, function(retryResponse) {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(retryResponse);
              }
            });
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Google 默认 favicon 的 base64 编码（蓝色地球图标）
const GOOGLE_DEFAULT_FAVICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACs0lEQVR4Aa3BzU+ScQAH8K8Pz/MAD/Dw8vASKCDE1La05dA5rUNrNk/e8NCh7ODJ/hw9NO+1iZdy6+LW5gEzBbdqOk0zwJJ4gB54fPDB54Hsx9LNQ53q88G/6sCFRGLRXNRK7rF4dEjXmrNSVY3X5IYVBG8zKU6HOc0a6flU+nDTx3rKyeSUCqIDRCKxaFZ0KRDr8c0o9bPJWETwhqIuQdNbYBkDIiEBKyu7lWxeEnkb++rgU2nByjiPk8kplQZR1EruW72dM6dq8+HNAX8wEhZg4VgM9nehfqohHOARDbmFj7vHwvMXGWss5sH7/cI8gCMKxFg8OiQrjcknj4eCkbCANk1vYX0rh0tegQPDGDD9aDhYq59NjsWjQyAoENpZc7Y76PSO3A7hkq63oOstOO0c2upqE9WaCqfdjFCn09to6LMgKBBSVY2Pj/cJdbWJq+7f6QFvodFmMdPove7FYf4HJiZuCJKkxkHQIGqyavW5efAWGhaORZffgS6/A7yFxiUDBRTLJ2jzuXnIsmoFQeGChWPRNjLYja+FKjS9iT9hGAPazvEbDYK3mZTDfJn3e0LgLTQe3I0hlcljD79FQ274PRzujURQrjaw91kEbzMpICgQLieXXlnZreCK/r4AxLICsaxgfSuLjQ/HaHM7TFhe3q64HFwaBAWCYei5bF4SU5k8/uZboYrWTyCVyeO4WBONJmYOhAEEZR+thwMO+9t3ubDnGm8PBewwshQYhoFYPkFbf18Ae4cini2sHTlsxqX09tHL3N5r2QBieGBa/16q7Pv9PLu2nhXSW0eUyWrkqrVTFEQZ8kkDq6sHlTer+zl8bR4rqB0cFBacLFCcWcn2ezAhURi0VzUSu7RwWj8TNOfSpIal08a1vPzc/A2kyK4uE3ORM9tpL9k7KynnExOqfgffgFLYRPR9aQhpgAAAABJRU5ErkJggg==';

// 使用 canvas 比较图片数据判断是否是默认图标
function isDefaultFavicon(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    // Google 默认图标 base64 长度很短（小于 ~1500 字符）
    const isSmallData = dataUrl.length < 2000;
    // Google 默认图标通常是 16x16 或 32x32
    const isSmallSize = img.naturalWidth <= 32 && img.naturalHeight <= 32;
    return isSmallData && isSmallSize;
  } catch {
    return false;
  }
}

// favicon 加载失败回调：显示首字母
function onFaviconError(img) {
  img.style.display = 'none';
  const fallback = img.nextElementSibling;
  if (fallback && fallback.classList.contains('favicon-fallback')) {
    fallback.style.display = 'flex';
  }
}

// 暴露函数到全局
window.LinkHubUtils = {
  escapeHtml,
  getDomain,
  isValidUrl,
  debounce,
  rgbToHsl,
  generateUUID,
  sendMessage,
  isDefaultFavicon,
  onFaviconError
};
