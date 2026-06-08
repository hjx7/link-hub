/**
 * URL 编解码工具
 */
// @ts-nocheck

export function urlEncode(): void {
  const input = document.getElementById('urlInput').value;
  document.getElementById('urlOutput').value = encodeURIComponent(input);
}

export function urlDecode(): void {
  const input = document.getElementById('urlInput').value;
  try { document.getElementById('urlOutput').value = decodeURIComponent(input); }
  catch (e) { document.getElementById('urlOutput').value = '解码失败: ' + e.message; }
}

export function urlSwap(): void {
  const input = document.getElementById('urlInput');
  const output = document.getElementById('urlOutput');
  input.value = output.value;
  output.value = '';
}

export function urlClear(): void {
  document.getElementById('urlInput').value = '';
  document.getElementById('urlOutput').value = '';
}
