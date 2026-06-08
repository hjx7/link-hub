/**
 * LinkHub - 工具函数模块
 */

/** URL 验证 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/** 防抖函数 */
export function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return function (this: unknown, ...args: unknown[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  } as T;
}

/** HTML 转义 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 获取域名 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 生成 UUID */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** 发送消息到 background service worker */
export function sendMessage<T = unknown>(request: { action: string; data?: unknown }): Promise<{ success: boolean; data?: T; error?: string }> {
  type Response = { success: boolean; data?: T; error?: string };
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(request, (response) => {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message?.includes('port closed')) {
            chrome.runtime.sendMessage(request, (retryResponse) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(retryResponse as Response);
              }
            });
          } else {
            reject(new Error(chrome.runtime.lastError.message!));
          }
        } else {
          resolve(response as Response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
