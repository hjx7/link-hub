/**
 * LinkHub New Tab - 终端模块
 * Tab 式布局：第一个 tab 固定为服务器列表，点击服务器新增终端 tab
 */

let _servers = [];
let _connections = [];
let _activeTabId = 'server-list';
let _connIdCounter = 0;

// 初始化
function initTerminal() {
  loadConfig();
  renderServerList();

  // 搜索框实时过滤
  const searchInput = document.getElementById('serverSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderServerList(searchInput.value.trim());
    });
  }
}

// 加载配置
function loadConfig() {
  try {
    const servers = localStorage.getItem('linkhub-servers');
    if (servers) _servers = JSON.parse(servers);
  } catch (e) {}
}

// 保存服务器列表
function saveServers() {
  localStorage.setItem('linkhub-servers', JSON.stringify(_servers));
}

// 渲染服务器列表
function renderServerList(filter) {
  const container = document.getElementById('serverList');
  if (!container) return;

  let list = _servers;
  if (filter) {
    const lower = filter.toLowerCase();
    list = _servers.filter(s =>
      (s.name && s.name.toLowerCase().includes(lower)) ||
      (s.host && s.host.toLowerCase().includes(lower)) ||
      (s.wsUrl && s.wsUrl.toLowerCase().includes(lower))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="terminal-server-empty">${filter ? '没有匹配的服务器' : '暂无服务器，点击右上角 + 添加'}</div>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="server-list-row" data-id="${s.id}">
      <span class="server-col-status"><span class="server-status-dot"></span></span>
      <span class="server-col-name" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.name)}</span>
      <span class="server-col-addr" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.host || s.wsUrl)}:${s.port || 22}</span>
      <span class="server-col-user" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.username)}</span>
      <span class="server-col-remark" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.remark || '')}</span>
      <span class="server-col-action">
        <button class="server-action-btn" data-action="connect-server" data-id="${s.id}">连接</button>
        <button class="server-action-btn server-action-edit" data-action="edit-server" data-id="${s.id}">编辑</button>
        <button class="server-action-btn server-action-del" data-action="delete-server" data-id="${s.id}">删除</button>
      </span>
    </div>
  `).join('');
}

// 打开添加服务器弹窗
function openAddServer() {
  document.getElementById('serverModalTitle').textContent = '添加服务器';
  document.getElementById('serverId').value = '';
  document.getElementById('serverName').value = '';
  document.getElementById('serverWsUrl').value = '';
  document.getElementById('serverPort').value = '22';
  document.getElementById('serverUsername').value = '';
  document.getElementById('serverPassword').value = '';
  document.getElementById('serverRemark').value = '';
  document.getElementById('serverModal').style.display = 'flex';
  document.getElementById('serverName').focus();
}

// 打开编辑服务器弹窗
function openEditServer(id) {
  const server = _servers.find(s => s.id === id);
  if (!server) return;

  document.getElementById('serverModalTitle').textContent = '编辑服务器';
  document.getElementById('serverId').value = server.id;
  document.getElementById('serverName').value = server.name;
  document.getElementById('serverWsUrl').value = server.wsUrl || server.host || '';
  document.getElementById('serverPort').value = server.port || 22;
  document.getElementById('serverUsername').value = server.username;
  document.getElementById('serverPassword').value = server.password || '';
  document.getElementById('serverRemark').value = server.remark || '';
  document.getElementById('serverModal').style.display = 'flex';
}

// 保存服务器
function saveServer() {
  const id = document.getElementById('serverId').value;
  const name = document.getElementById('serverName').value.trim();
  const wsUrl = document.getElementById('serverWsUrl').value.trim();
  const port = parseInt(document.getElementById('serverPort').value) || 22;
  const username = document.getElementById('serverUsername').value.trim();
  const password = document.getElementById('serverPassword').value;
  const remark = document.getElementById('serverRemark').value.trim();

  if (!name || !wsUrl || !username) {
    alert('请填写名称、服务器地址和用户名');
    return;
  }

  if (id) {
    const idx = _servers.findIndex(s => s.id === id);
    if (idx >= 0) {
      _servers[idx] = { ..._servers[idx], name, wsUrl, port, username, password, remark, host: wsUrl };
    }
  } else {
    _servers.push({
      id: Date.now().toString(),
      name, wsUrl, port, username, password, remark, host: wsUrl
    });
  }

  saveServers();
  renderServerList();
  closeServerModal();
}

// 删除服务器
function deleteServer(id) {
  if (!confirm('确定删除这个服务器？')) return;
  _servers = _servers.filter(s => s.id !== id);
  saveServers();
  renderServerList();
}

// 关闭服务器弹窗
function closeServerModal() {
  document.getElementById('serverModal').style.display = 'none';
}

// 连接服务器
function connectServer(serverId) {
  const server = _servers.find(s => s.id === serverId);
  if (!server) return;

  const host = server.wsUrl || server.host;
  if (!host) {
    alert('请配置服务器地址');
    return;
  }

  const wsUrl = 'ws://localhost:18022/ws';
  const connId = 'conn_' + (++_connIdCounter);

  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    alert('WebSocket 连接失败: ' + e.message);
    return;
  }

  // 创建终端面板（带文件列表侧栏）
  const termPanel = document.createElement('div');
  termPanel.id = `panel-${connId}`;
  termPanel.className = 'terminal-panel';
  termPanel.innerHTML = `
    <div class="term-layout">
      <div class="term-file-panel" id="files-${connId}">
        <div class="term-file-header">
          <span class="term-file-path" id="filepath-${connId}">/</span>
          <button class="term-file-btn" data-action="upload-file" data-conn="${connId}" title="上传文件">📤</button>
          <button class="term-file-btn" data-action="refresh-files" data-conn="${connId}" title="刷新">🔄</button>
          <input type="file" id="fileInput-${connId}" style="display:none" multiple>
        </div>
        <div class="term-file-list" id="filelist-${connId}"></div>
      </div>
      <div class="term-terminal-area" id="termarea-${connId}"></div>
    </div>
  `;
  document.getElementById('terminalBody').appendChild(termPanel);

  const terminal = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    rows: 24,
    cols: 80,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      selectionBackground: '#264f78'
    }
  });

  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById(`termarea-${connId}`));

  const conn = { id: connId, ws, terminal, fitAddon, serverId, panel: termPanel, name: server.name };
  _connections.push(conn);

  // 切换到新 tab
  switchTab(connId);

  // 延迟 fit
  setTimeout(() => {
    fitAddon.fit();
  }, 200);

  // WebSocket 事件
  ws.onopen = () => {
    terminal.writeln('\x1b[33mConnecting to ' + server.name + ' (' + host + ')...\x1b[0m');
    setTimeout(() => {
      const dims = fitAddon.proposeDimensions();
      ws.send(JSON.stringify({
        type: 'connect',
        host: host,
        port: server.port || 22,
        username: server.username,
        password: server.password,
        cols: dims?.cols || 120,
        rows: dims?.rows || 40
      }));
    }, 300);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'connected':
          terminal.writeln('\x1b[32mConnected!\x1b[0m\r\n');
          // 文件列表会由 Go 端 SFTP 准备好后自动推送
          break;
        case 'output':
          terminal.write(msg.data);
          break;
        case 'error':
          // 文件操作错误不显示在终端
          if (msg.data && (msg.data.includes('list dir') || msg.data.includes('SFTP') || msg.data.includes('upload'))) {
            const listEl = document.getElementById(`filelist-${connId}`);
            if (listEl) listEl.innerHTML = `<div class="term-file-error">${msg.data}</div>`;
          } else {
            terminal.writeln('\x1b[31mError: ' + msg.data + '\x1b[0m');
          }
          break;
        case 'disconnect':
          terminal.writeln('\r\n\x1b[33m' + (msg.data || 'Disconnected') + '\x1b[0m');
          break;
        case 'dirList':
          renderFileList(connId, msg.path, msg.files || []);
          break;
        case 'cwd':
          // 收到当前目录，刷新文件列表
          if (msg.data) {
            const currentDisplayPath = document.getElementById(`filepath-${connId}`)?.textContent;
            // 只有目录变化时才刷新
            if (msg.data !== currentDisplayPath) {
              ws.send(JSON.stringify({ type: 'listDir', path: msg.data }));
            }
          }
          break;
        case 'uploadOk':
          const curPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
          ws.send(JSON.stringify({ type: 'listDir', path: curPath }));
          break;
      }
    } catch (err) {}
  };

  ws.onerror = () => {
    try { terminal.writeln('\x1b[31mWebSocket error\x1b[0m'); } catch(e) {}
  };

  ws.onclose = () => {
    try { terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m'); } catch(e) {}
  };

  // 终端输入
  terminal.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));

      // 每次按回车后，延迟获取当前目录并刷新文件列表
      if (data === '\r' || data === '\n') {
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'getCwd' }));
          }
        }, 500);
      }
    }
  });

  // 窗口大小变化
  const resizeHandler = () => {
    if (_activeTabId === connId) {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    }
  };
  window.addEventListener('resize', resizeHandler);
  conn._resizeHandler = resizeHandler;
}

// 切换 tab
function switchTab(tabId) {
  _activeTabId = tabId;

  // 隐藏所有面板
  document.querySelectorAll('#terminalBody .terminal-panel').forEach(p => {
    p.classList.remove('active');
  });

  // 显示目标面板
  if (tabId === 'server-list') {
    document.getElementById('serverListPanel').classList.add('active');
  } else {
    const conn = _connections.find(c => c.id === tabId);
    if (conn) {
      conn.panel.classList.add('active');
      setTimeout(() => {
        conn.fitAddon.fit();
        conn.terminal.focus();
      }, 50);
    }
  }

  renderTabs();
}

// 关闭连接 tab
function closeConnection(connId) {
  const idx = _connections.findIndex(c => c.id === connId);
  if (idx === -1) return;

  const conn = _connections[idx];

  if (conn.ws.readyState === WebSocket.OPEN) {
    try {
      conn.ws.send(JSON.stringify({ type: 'disconnect' }));
    } catch(e) {}
    conn.ws.close();
  }

  conn.terminal.dispose();
  conn.panel.remove();

  if (conn._resizeHandler) {
    window.removeEventListener('resize', conn._resizeHandler);
  }

  _connections.splice(idx, 1);

  // 如果关闭的是当前 tab，切回服务器列表
  if (_activeTabId === connId) {
    switchTab('server-list');
  } else {
    renderTabs();
  }
}

// 渲染 tabs
function renderTabs() {
  const container = document.getElementById('terminalTabs');
  if (!container) return;

  let html = `
    <button class="terminal-sidebar-toggle" id="sidebarToggle" data-action="toggle-sidebar" title="收起/展开侧栏">☰</button>
    <div class="terminal-tab ${_activeTabId === 'server-list' ? 'active' : ''}" data-action="switch-conn" data-id="server-list">
      <span class="terminal-tab-name">📋</span>
    </div>
  `;

  for (const conn of _connections) {
    html += `
      <div class="terminal-tab ${conn.id === _activeTabId ? 'active' : ''}" data-action="switch-conn" data-id="${conn.id}">
        <span class="terminal-tab-name">${escapeHtml(conn.name)}</span>
        <button class="terminal-tab-close action-btn" data-action="close-conn" data-id="${conn.id}">×</button>
      </div>
    `;
  }

  container.innerHTML = html;
}

// 渲染文件列表
function renderFileList(connId, path, files) {
  const pathEl = document.getElementById(`filepath-${connId}`);
  const listEl = document.getElementById(`filelist-${connId}`);
  if (!pathEl || !listEl) return;

  pathEl.textContent = path;

  // 排序：文件夹在前，文件在后
  files.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  let html = '';

  // 上级目录
  if (path !== '/') {
    html += `<div class="term-file-item" data-action="nav-dir" data-conn="${connId}" data-path="${path}/..">
      <span class="term-file-icon">📁</span>
      <span class="term-file-name">..</span>
    </div>`;
  }

  for (const f of files) {
    const icon = f.isDir ? '📁' : '📄';
    const size = f.isDir ? '' : formatFileSize(f.size);
    if (f.isDir) {
      html += `<div class="term-file-item" data-action="nav-dir" data-conn="${connId}" data-path="${path}/${f.name}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    } else {
      html += `<div class="term-file-item">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    }
  }

  listEl.innerHTML = html;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

// 刷新文件列表
function refreshFiles(connId) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
  const path = document.getElementById(`filepath-${connId}`)?.textContent || '.';
  conn.ws.send(JSON.stringify({ type: 'listDir', path }));
}

// 导航目录
function navDir(connId, path) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
  conn.ws.send(JSON.stringify({ type: 'listDir', path }));
}

// 上传文件
function uploadFile(connId) {
  const input = document.getElementById(`fileInput-${connId}`);
  if (!input) return;
  input.click();
  input.onchange = () => {
    const conn = _connections.find(c => c.id === connId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;
    const path = document.getElementById(`filepath-${connId}`)?.textContent || '.';

    for (const file of input.files) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        conn.ws.send(JSON.stringify({
          type: 'upload',
          path: path,
          fileName: file.name,
          fileData: base64
        }));
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  };
}

// HTML 转义
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// DOM 加载后初始化
document.addEventListener('DOMContentLoaded', initTerminal);

// 暴露到全局
window.LinkHubTerminal = {
  connectServer,
  openAddServer,
  openEditServer,
  saveServer,
  deleteServer,
  closeServerModal,
  switchTab,
  closeConnection,
  refreshFiles,
  navDir,
  uploadFile
};
