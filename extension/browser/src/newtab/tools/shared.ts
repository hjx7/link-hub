/**
 * 工具模块共享函数
 */

/** 显示复制成功提示 */
export function showCopyToast(): void {
  const existing = document.querySelector('.copy-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = '✓ 已复制到剪贴板';
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 1500);
}

/** 格式化日期 */
export function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
