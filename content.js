/**
 * LinkHub - Content Script
 * 在普通网页上 Ctrl+K 唤起命令面板（iframe 方案）
 */

(function() {
  // 防止重复注入
  if (window._linkhubLoaded) return;
  window._linkhubLoaded = true;

  let iframe = null;
  let visible = false;

  function show() {
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.src = chrome.runtime.getURL('command/index.html');
      iframe.setAttribute('allowtransparency', 'true');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:2147483647;background:transparent;color-scheme:auto;';
      document.body.appendChild(iframe);
    } else {
      iframe.style.display = 'block';
    }
    visible = true;
    // 通知 iframe 获取焦点
    setTimeout(() => {
      iframe.contentWindow?.postMessage({ type: 'linkhub-focus' }, '*');
    }, 50);
  }

  function hide() {
    if (iframe) {
      iframe.style.display = 'none';
    }
    visible = false;
  }

  // 监听 Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      visible ? hide() : show();
    }
  }, true);

  // 监听来自 iframe 的消息
  window.addEventListener('message', (e) => {
    if (!e.data || !e.data.type) return;
    switch (e.data.type) {
      case 'linkhub-close':
        hide();
        break;
      case 'linkhub-open-url':
        hide();
        window.open(e.data.url, '_blank');
        break;
      case 'linkhub-open-tab':
        hide();
        chrome.runtime.sendMessage({ action: 'openLinkHub', data: e.data.page });
        break;
    }
  });
})();
