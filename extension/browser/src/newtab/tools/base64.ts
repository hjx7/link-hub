/**
 * Base64 编解码工具
 */
// @ts-nocheck

export function base64Encode(): void {
  const input = document.getElementById('base64Input').value;
  try { document.getElementById('base64Output').value = btoa(unescape(encodeURIComponent(input))); }
  catch (e) { document.getElementById('base64Output').value = '编码失败: ' + e.message; }
}

export function base64Decode(): void {
  const input = document.getElementById('base64Input').value;
  try { document.getElementById('base64Output').value = decodeURIComponent(escape(atob(input))); }
  catch (e) { document.getElementById('base64Output').value = '解码失败: ' + e.message; }
}

export function base64Swap(): void {
  const input = document.getElementById('base64Input');
  const output = document.getElementById('base64Output');
  input.value = output.value;
  output.value = '';
}

export function base64Clear(): void {
  document.getElementById('base64Input').value = '';
  document.getElementById('base64Output').value = '';
}
