/**
 * LinkHub New Tab - 终端模块
 */
// @ts-nocheck

import { escapeHtml } from './utils';

let _servers = [];
let _connections = [];
let _activeTabId = 'server-list';
let _connIdCounter = 0;
let _groups = [];         // 分组列表
let _selectedGroup = 'all'; // 当前选中的分组
let _statusCheckTimer = null; // 服务器状态检测定时器

// ===== 共用辅助函数 =====

// 调度自动重连
function scheduleReconnect(conn, connId) {
  if (conn._autoReconnectTimer) return;
  conn._reconnectAttempts = (conn._reconnectAttempts || 0) + 1;
  if (conn._reconnectAttempts <= 3) {
    conn._autoReconnectTimer = setTimeout(() => {
      conn._autoReconnectTimer = null;
      if (conn._disconnected) reconnect(connId);
    }, 3000);
  } else {
    conn.terminal.writeln('\x1b[31mAuto-reconnect failed after 3 attempts.\x1b[0m');
    conn.terminal.writeln('\x1b[90mPress Enter to try again.\x1b[0m');
  }
}

// 处理 WebSocket 消息（连接和重连共用）
function handleWsMessage(conn, connId, ws, msg) {
  switch (msg.type) {
    case 'connected':
      conn.terminal.writeln('\x1b[32mConnected!\x1b[0m\r\n');
      conn._reconnectAttempts = 0;
      conn._disconnected = false;
      ws.send(JSON.stringify({ type: 'getSysInfo' }));
      break;
    case 'sysInfo':
      if (msg.data) {
        try {
          const info = JSON.parse(msg.data);
          const server = _servers.find(s => s.id === conn.serverId);
          if (server) {
            server._sysInfo = info;
            saveServers();
            const searchInput = document.getElementById('serverSearchInput');
            renderServerList(searchInput ? searchInput.value.trim() : '');
          }
        } catch (e) {
          console.warn('[terminal] Failed to parse sysInfo:', e);
        }
      }
      break;
    case 'output':
      conn.terminal.write(msg.data);
      break;
    case 'error':
      if (msg.data && (msg.data.includes('list dir') || msg.data.includes('SFTP') || msg.data.includes('upload'))) {
        const listEl = document.getElementById(`filelist-${connId}`);
        if (listEl) listEl.innerHTML = `<div class="term-file-error">${msg.data}</div>`;
      } else if (msg.data && msg.data.includes('SSH connect failed')) {
        conn.terminal.writeln('\x1b[31m' + msg.data + '\x1b[0m');
        conn.terminal.writeln('\x1b[90mPress Enter to retry...\x1b[0m');
        conn._disconnected = true;
      } else {
        conn.terminal.writeln('\x1b[31mError: ' + msg.data + '\x1b[0m');
      }
      break;
    case 'disconnect':
      conn.terminal.writeln('\r\n\x1b[33m' + (msg.data || 'Disconnected') + '\x1b[0m');
      conn.terminal.writeln('\x1b[90mAuto-reconnecting in 3s... (Press Enter to reconnect now)\x1b[0m');
      conn._disconnected = true;
      scheduleReconnect(conn, connId);
      break;
    case 'dirList':
      renderFileList(connId, msg.path, msg.files || []);
      break;
    case 'cwd':
      if (msg.data) {
        const newPath = msg.data.trim();
        const currentDisplayPath = (document.getElementById(`filepath-${connId}`)?.textContent || '').trim();
        if (newPath && newPath !== currentDisplayPath) {
          ws.send(JSON.stringify({ type: 'listDir', path: newPath }));
        }
      }
      break;
    case 'uploadOk': {
      const curPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
      ws.send(JSON.stringify({ type: 'listDir', path: curPath }));
      break;
    }
    case 'renameOk': {
      const rPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
      ws.send(JSON.stringify({ type: 'listDir', path: rPath }));
      break;
    }
    case 'fileContent':
      handleFileContent(connId, msg.path, msg.data);
      break;
  }
}

// 绑定 WebSocket 事件（连接和重连共用）
function bindWsEvents(conn, connId, ws) {
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleWsMessage(conn, connId, ws, msg);
    } catch (err) {
      console.warn('[terminal] Failed to parse WS message:', err);
    }
  };

  ws.onerror = () => {
    conn.terminal.writeln('\x1b[31mWebSocket error\x1b[0m');
  };

  ws.onclose = () => {
    conn.terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
    conn.terminal.writeln('\x1b[90mAuto-reconnecting in 3s... (Press Enter to reconnect now)\x1b[0m');
    conn._disconnected = true;
    scheduleReconnect(conn, connId);
  };
}

// 构建连接消息
function buildConnectMsg(server, dims) {
  const host = server.wsUrl || server.host;
  const useKey = server.authType === 'key' && server.privateKey;
  const msg = {
    type: 'connect',
    host: host,
    port: server.port || 22,
    username: server.username,
    cols: dims?.cols || 120,
    rows: dims?.rows || 40
  };
  if (useKey) {
    msg.key = server.privateKey;
    if (server.keyPassphrase) msg.password = server.keyPassphrase;
  } else {
    msg.password = server.password;
  }
  return msg;
}

// 初始化
function initTerminal() {
  loadConfig();
  renderGroupList();
  renderServerList();
  // 检测服务器在线状态
  checkServersStatus();

  // 搜索框实时过滤
  const searchInput = document.getElementById('serverSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderServerList(searchInput.value.trim());
    });
  }

  // 全选复选框
  const checkAll = document.getElementById('serverCheckAll');
  if (checkAll) {
    checkAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.terminal-server-list .server-checkbox');
      checkboxes.forEach(cb => { cb.checked = checkAll.checked; });
    });
  }

  // 文件列表右键菜单
  document.getElementById('terminalBody')?.addEventListener('contextmenu', (e) => {
    const fileItem = e.target.closest('.term-file-item');
    if (fileItem && fileItem.dataset.filepath) {
      showFileContextMenu(e, fileItem.dataset.conn, fileItem.dataset.filepath, fileItem.dataset.name, fileItem.dataset.isdir);
    }
  });

  // 分组右键菜单
  document.getElementById('serverGroupList')?.addEventListener('contextmenu', (e) => {
    const groupItem = e.target.closest('.server-group-item');
    if (groupItem && groupItem.dataset.group && groupItem.dataset.group !== 'all') {
      showGroupContextMenu(e, groupItem.dataset.group);
    }
  });

  // 监听片段发送事件
  document.addEventListener('linkhub-send-to-terminal', (e) => {
    const content = e.detail;
    if (!content) return;
    // 找到当前活跃的终端连接
    const conn = _connections.find(c => c.id === _activeTabId);
    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({ type: 'input', data: content }));
    }
  });
}

// 渲染服务器信息标签
function renderServerInfo(info) {
  if (!info) return '<span class="server-info-tag">--</span>';
  const tags = [];
  if (info.os) tags.push(info.os);
  if (info.cpu) tags.push(info.cpu);
  if (info.mem) tags.push(info.mem.replace('Gi', 'G').replace('Mi', 'M').replace('Ti', 'T'));
  if (info.disk) tags.push(info.disk.replace('Gi', 'G').replace('Mi', 'M').replace('Ti', 'T'));
  if (tags.length === 0) return '<span class="server-info-tag">--</span>';
  return tags.map(t => `<span class="server-info-tag">${escapeHtml(t)}</span>`).join('');
}

// 检测服务器在线状态和延迟
function checkServersStatus() {
  if (_servers.length === 0) {
    _statusCheckTimer = setTimeout(checkServersStatus, 30000);
    return;
  }

  let pending = _servers.length;

  for (const server of _servers) {
    const host = server.wsUrl || server.host;
    if (!host) {
      pending--;
      continue;
    }
    const port = server.port || 22;
    fetch(`http://localhost:18022/ping?host=${encodeURIComponent(host)}&port=${port}`)
      .then(res => res.json())
      .then(data => {
        server._online = data.ok === true;
        server._latency = data.latency !== undefined ? data.latency : null;
      })
      .catch(() => {
        server._online = false;
        server._latency = null;
      })
      .finally(() => {
        pending--;
        if (pending <= 0) {
          const searchInput = document.getElementById('serverSearchInput');
          const filter = searchInput ? searchInput.value.trim() : '';
          renderServerList(filter);
        }
      });
  }

  _statusCheckTimer = setTimeout(checkServersStatus, 30000);
}

// 停止状态检测
function stopStatusCheck() {
  if (_statusCheckTimer) {
    clearTimeout(_statusCheckTimer);
    _statusCheckTimer = null;
  }
}

// 加载配置
function loadConfig() {
  try {
    const servers = localStorage.getItem('linkhub-servers');
    if (servers) _servers = JSON.parse(servers);
    const groups = localStorage.getItem('linkhub-server-groups');
    if (groups) _groups = JSON.parse(groups);
    // 加载缓存的系统信息
    const sysInfoCache = localStorage.getItem('linkhub-sysinfo');
    if (sysInfoCache) {
      const cache = JSON.parse(sysInfoCache);
      for (const s of _servers) {
        if (cache[s.id]) s._sysInfo = cache[s.id];
      }
    }
  } catch (e) {
    console.warn('[terminal] Failed to load config:', e);
  }
}

// 保存服务器列表
function saveServers() {
  localStorage.setItem('linkhub-servers', JSON.stringify(_servers));
  localStorage.setItem('linkhub-server-groups', JSON.stringify(_groups));
  // 缓存系统信息
  const cache = {};
  for (const s of _servers) {
    if (s._sysInfo) cache[s.id] = s._sysInfo;
  }
  localStorage.setItem('linkhub-sysinfo', JSON.stringify(cache));
}

// 渲染分组列表
function renderGroupList() {
  const container = document.getElementById('serverGroupList');
  if (!container) return;

  let html = `<div class="server-group-item ${_selectedGroup === 'all' ? 'active' : ''}" data-action="select-group" data-group="all">
    <span class="server-group-name">全部</span>
    <span class="server-group-count">${_servers.length}</span>
  </div>`;

  for (const g of _groups) {
    const count = _servers.filter(s => s.group === g.id).length;
    html += `<div class="server-group-item ${_selectedGroup === g.id ? 'active' : ''}" data-action="select-group" data-group="${g.id}" data-name="${escapeHtml(g.name)}">
      <span class="server-group-name">${escapeHtml(g.name)}</span>
      <span class="server-group-count">${count}</span>
    </div>`;
  }

  container.innerHTML = html;

  // 更新添加服务器表单的分组下拉
  updateGroupSelect();
}

// 更新分组下拉选项
function updateGroupSelect() {
  const select = document.getElementById('serverGroup');
  if (!select) return;
  let html = '<option value="">全部</option>';
  for (const g of _groups) {
    html += `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
  }
  select.innerHTML = html;
}

// 添加分组
let _editingGroupId = null;

function addGroup() {
  _editingGroupId = null;
  document.getElementById('groupModalTitle').textContent = '添加分组';
  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupModal').style.display = 'flex';
  document.getElementById('groupNameInput').focus();
}

// 编辑分组
function editGroup(groupId) {
  const group = _groups.find(g => g.id === groupId);
  if (!group) return;
  _editingGroupId = groupId;
  document.getElementById('groupModalTitle').textContent = '编辑分组';
  document.getElementById('groupNameInput').value = group.name;
  document.getElementById('groupModal').style.display = 'flex';
  document.getElementById('groupNameInput').focus();
}

// 保存分组
function saveGroup() {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) {
    alert('请输入分组名称');
    return;
  }

  if (_editingGroupId) {
    const group = _groups.find(g => g.id === _editingGroupId);
    if (group) group.name = name;
  } else {
    _groups.push({ id: Date.now().toString(), name });
  }

  saveServers();
  renderGroupList();
  closeGroupModal();
}

// 关闭分组弹窗
function closeGroupModal() {
  document.getElementById('groupModal').style.display = 'none';
  _editingGroupId = null;
}

// 删除分组
function deleteGroup(groupId) {
  if (!confirm('确定删除这个分组？（服务器不会被删除）')) return;
  _groups = _groups.filter(g => g.id !== groupId);
  _servers.forEach(s => { if (s.group === groupId) s.group = ''; });
  saveServers();
  if (_selectedGroup === groupId) _selectedGroup = 'all';
  renderGroupList();
  renderServerList();
}

// 分组右键菜单
let _groupContextMenu = null;
let _groupContextId = null;

function showGroupContextMenu(e, groupId) {
  e.preventDefault();
  _groupContextId = groupId;

  if (!_groupContextMenu) {
    _groupContextMenu = document.createElement('div');
    _groupContextMenu.className = 'file-context-menu';
    _groupContextMenu.innerHTML = `
      <button class="file-ctx-item" data-action="ctx-edit-group"><span>✏️</span> 编辑</button>
      <button class="file-ctx-item" data-action="ctx-delete-group"><span>🗑️</span> 删除</button>
    `;
    document.body.appendChild(_groupContextMenu);
    document.addEventListener('click', () => hideGroupContextMenu());
  }

  _groupContextMenu.style.display = 'block';
  _groupContextMenu.style.left = e.clientX + 'px';
  _groupContextMenu.style.top = e.clientY + 'px';
}

function hideGroupContextMenu() {
  if (_groupContextMenu) {
    _groupContextMenu.style.display = 'none';
  }
  _groupContextId = null;
}

function ctxEditGroup() {
  if (_groupContextId) editGroup(_groupContextId);
  hideGroupContextMenu();
}

function ctxDeleteGroup() {
  if (_groupContextId) deleteGroup(_groupContextId);
  hideGroupContextMenu();
}

// 选择分组
function selectGroup(groupId) {
  _selectedGroup = groupId;
  renderGroupList();
  renderServerList();
}

// 排序
let _sortField = null;
let _sortAsc = true;

function sortServers(field) {
  if (_sortField === field) {
    _sortAsc = !_sortAsc;
  } else {
    _sortField = field;
    _sortAsc = true;
  }
  renderServerList();
}

// 渲染服务器列表
function renderServerList(filter) {
  const container = document.getElementById('serverList');
  if (!container) return;

  let list = _servers;

  // 按分组筛选
  if (_selectedGroup !== 'all') {
    list = list.filter(s => s.group === _selectedGroup);
  }

  // 按搜索词筛选
  if (filter) {
    const lower = filter.toLowerCase();
    list = list.filter(s =>
      (s.name && s.name.toLowerCase().includes(lower)) ||
      (s.host && s.host.toLowerCase().includes(lower)) ||
      (s.wsUrl && s.wsUrl.toLowerCase().includes(lower))
    );
  }

  // 排序
  if (_sortField) {
    list = [...list].sort((a, b) => {
      let va, vb;
      if (_sortField === 'name') {
        va = (a.name || '').toLowerCase();
        vb = (b.name || '').toLowerCase();
      } else if (_sortField === 'addr') {
        va = (a.host || a.wsUrl || '').toLowerCase();
        vb = (b.host || b.wsUrl || '').toLowerCase();
      }
      if (va < vb) return _sortAsc ? -1 : 1;
      if (va > vb) return _sortAsc ? 1 : -1;
      return 0;
    });
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="terminal-server-empty">${filter ? '没有匹配的服务器' : '暂无服务器，点击右上角 + 添加'}</div>`;
    return;
  }

  container.innerHTML = list.map(s => {
    const host = s.host || s.wsUrl || '';
    const statusClass = s._online === false ? 'offline' : 'online';
    const latencyText = s._latency !== null && s._latency !== undefined ? s._latency + 'ms' : '--';
    const infoHtml = renderServerInfo(s._sysInfo);
    return `
    <div class="server-list-row" data-id="${s.id}">
      <span class="server-col-status"><input type="checkbox" class="server-checkbox" data-id="${s.id}"></span>
      <span class="server-col-latency">${latencyText}</span>
      <span class="server-col-name" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.name)}</span>
      <span class="server-col-addr" data-action="connect-server" data-id="${s.id}">${escapeHtml(host)}</span>
      <span class="server-col-user" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.username)}</span>
      <span class="server-col-info" data-action="connect-server" data-id="${s.id}">${infoHtml}</span>
      <span class="server-col-remark" data-action="connect-server" data-id="${s.id}">${escapeHtml(s.remark || '')}</span>
      <span class="server-col-action">
        <button class="server-action-btn" data-action="connect-server" data-id="${s.id}">连接</button>
        <button class="server-action-btn server-action-edit" data-action="edit-server" data-id="${s.id}">编辑</button>
        <button class="server-action-btn server-action-del" data-action="delete-server" data-id="${s.id}">删除</button>
      </span>
    </div>`;
  }).join('');
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
  document.getElementById('serverPrivateKey').value = '';
  document.getElementById('serverKeyPassphrase').value = '';
  document.getElementById('serverRemark').value = '';
  switchAuthType('password');
  updateGroupSelect();
  document.getElementById('serverGroup').value = '';
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
  document.getElementById('serverPrivateKey').value = server.privateKey || '';
  document.getElementById('serverKeyPassphrase').value = server.keyPassphrase || '';
  document.getElementById('serverRemark').value = server.remark || '';
  switchAuthType(server.authType || 'password');
  updateGroupSelect();
  document.getElementById('serverGroup').value = server.group || '';
  document.getElementById('serverModal').style.display = 'flex';
}

// 切换认证方式
function switchAuthType(type) {
  document.getElementById('serverAuthType').value = type;
  document.getElementById('authPanelPassword').style.display = type === 'password' ? 'block' : 'none';
  document.getElementById('authPanelKey').style.display = type === 'key' ? 'block' : 'none';
  document.querySelectorAll('.srv-auth-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.auth === type);
  });
}

// 保存服务器
function saveServer() {
  const id = document.getElementById('serverId').value;
  const name = document.getElementById('serverName').value.trim();
  const wsUrl = document.getElementById('serverWsUrl').value.trim();
  const port = parseInt(document.getElementById('serverPort').value) || 22;
  const username = document.getElementById('serverUsername').value.trim();
  const authType = document.getElementById('serverAuthType').value;
  const password = document.getElementById('serverPassword').value;
  const privateKey = document.getElementById('serverPrivateKey').value;
  const keyPassphrase = document.getElementById('serverKeyPassphrase').value;
  const remark = document.getElementById('serverRemark').value.trim();
  const group = document.getElementById('serverGroup').value;

  if (!name || !wsUrl || !username) {
    alert('请填写名称、服务器地址和用户名');
    return;
  }

  const serverData = { name, wsUrl, port, username, authType, password, privateKey, keyPassphrase, remark, group, host: wsUrl };

  if (id) {
    const idx = _servers.findIndex(s => s.id === id);
    if (idx >= 0) {
      _servers[idx] = { ..._servers[idx], ...serverData };
    }
  } else {
    _servers.push({
      id: Date.now().toString(),
      ...serverData
    });
  }

  saveServers();
  renderGroupList();
  renderServerList();
  closeServerModal();
}

// 删除服务器
function deleteServer(id) {
  if (!confirm('确定删除这个服务器？')) return;
  _servers = _servers.filter(s => s.id !== id);
  saveServers();
  renderGroupList();
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
      <button class="term-file-toggle" id="filetoggle-${connId}" data-action="toggle-file-panel" data-conn="${connId}" title="\u6253\u5f00\u6587\u4ef6\u5217\u8868"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></svg></button>
      <div class="term-file-panel" id="files-${connId}">
        <div class="term-file-header">
          <span class="term-file-path" id="filepath-${connId}">/</span>
          <button class="term-file-btn" data-action="refresh-files" data-conn="${connId}" title="\u5237\u65b0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
          <button class="term-file-btn" data-action="upload-file" data-conn="${connId}" title="\u4e0a\u4f20\u6587\u4ef6"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
          <button class="term-file-btn" data-action="toggle-file-panel" data-conn="${connId}" title="\u9690\u85cf\u6587\u4ef6\u5217\u8868"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg></button>
          <input type="file" id="fileInput-${connId}" style="display:none" multiple>
        </div>
        <div class="term-file-pager-top" id="filepager-${connId}"></div>
        <div class="term-file-list" id="filelist-${connId}"></div>
        <div class="term-upload-status" id="uploadstatus-${connId}"></div>
      </div>
      <div class="term-splitter" id="splitter-${connId}"></div>
      <div class="term-wrapper" id="termwrapper-${connId}">
        <div class="term-terminal-area" id="termarea-${connId}"></div>
      </div>
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
      background: '#111111',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#111111',
      selectionBackground: '#264f78',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#89d185',
      yellow: '#d7ba7d',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#d4d4d4',
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#73c991',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#d16d9e',
      brightCyan: '#56d4bc',
      brightWhite: '#ffffff'
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

  // 初始化分割条拖动
  initTermSplitter(connId, fitAddon);

  // 初始化拖拽上传
  initDragUpload(connId);

  // WebSocket 事件
  ws.onopen = () => {
    terminal.writeln('\x1b[33mConnecting to ' + server.name + ' (' + host + ')...\x1b[0m');

    const useKey = server.authType === 'key' && server.privateKey;

    if (!useKey && !server.password) {
      // 没有密码也没有密钥，进入密码输入模式
      terminal.writeln('\x1b[32m' + server.username + '@' + host + '\x1b[0m');
      terminal.write('Password: ');
      conn._waitingPassword = true;
      conn._passwordBuffer = '';
    } else {
      setTimeout(() => {
        const dims = fitAddon.proposeDimensions();
        ws.send(JSON.stringify(buildConnectMsg(server, dims)));
      }, 300);
    }
  };

  bindWsEvents(conn, connId, ws);

  // 终端输入
  terminal.onData((data) => {
    // 密码输入模式
    if (conn._waitingPassword) {
      if (data === '\r' || data === '\n') {
        terminal.writeln('');
        const password = conn._passwordBuffer;
        conn._waitingPassword = false;
        conn._passwordBuffer = '';
        // 发送连接请求
        const dims = fitAddon.proposeDimensions();
        conn.ws.send(JSON.stringify({
          type: 'connect',
          host: host,
          port: server.port || 22,
          username: server.username,
          password: password,
          cols: dims?.cols || 120,
          rows: dims?.rows || 40
        }));
      } else if (data === '\x7f' || data === '\b') {
        // 退格
        if (conn._passwordBuffer.length > 0) {
          conn._passwordBuffer = conn._passwordBuffer.slice(0, -1);
        }
      } else if (data.length === 1 && data >= ' ') {
        conn._passwordBuffer += data;
        // 不回显密码
      }
      return;
    }

    if (conn.ws.readyState === WebSocket.OPEN) {
      // SSH 断开但 WebSocket 仍连接时，按回车触发重连
      if (conn._disconnected && (data === '\r' || data === '\n')) {
        if (conn._autoReconnectTimer) {
          clearTimeout(conn._autoReconnectTimer);
          conn._autoReconnectTimer = null;
        }
        conn._reconnectAttempts = 0;
        reconnect(connId);
        return;
      }

      conn.ws.send(JSON.stringify({ type: 'input', data }));
    } else if (conn._disconnected && (data === '\r' || data === '\n')) {
      // 断开后按回车重连
      if (conn._autoReconnectTimer) {
        clearTimeout(conn._autoReconnectTimer);
        conn._autoReconnectTimer = null;
      }
      conn._reconnectAttempts = 0;
      reconnect(connId);
    }
  });

  // 窗口大小变化
  const resizeHandler = () => {
    if (_activeTabId === connId) {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
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
      if (!conn._isBatch) {
        setTimeout(() => {
          conn.fitAddon.fit();
          conn.terminal.focus();
        }, 50);
      }
    }
  }

  renderTabs();
}

// 重连
function reconnect(connId) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn) return;
  const server = _servers.find(s => s.id === conn.serverId);
  if (!server) return;

  conn._disconnected = false;
  conn.terminal.writeln('\r\n\x1b[33mReconnecting...\x1b[0m');

  const wsUrl = 'ws://localhost:18022/ws';

  let newWs;
  try {
    newWs = new WebSocket(wsUrl);
  } catch (e) {
    conn.terminal.writeln('\x1b[31mReconnect failed: ' + e.message + '\x1b[0m');
    conn._disconnected = true;
    return;
  }

  // 替换旧的 ws
  conn.ws = newWs;

  newWs.onopen = () => {
    setTimeout(() => {
      const dims = conn.fitAddon.proposeDimensions();
      newWs.send(JSON.stringify(buildConnectMsg(server, dims)));
    }, 300);
  };

  bindWsEvents(conn, connId, newWs);
}

// 关闭连接 tab
function closeConnection(connId) {
  const idx = _connections.findIndex(c => c.id === connId);
  if (idx === -1) return;

  const conn = _connections[idx];

  if (conn._isBatch) {
    // 批量终端 tab，关闭所有子连接
    if (conn._batchConns) {
      for (const bc of conn._batchConns) {
        if (bc.ws && bc.ws.readyState === WebSocket.OPEN) {
          try { bc.ws.send(JSON.stringify({ type: 'disconnect' })); } catch(e) {}
          bc.ws.close();
        }
        bc.terminal.dispose();
      }
    }
    if (conn._resizeHandler) {
      window.removeEventListener('resize', conn._resizeHandler);
    }
    conn.panel.remove();
  } else {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
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

    // 清理文件 tab 数据
    delete _fileTabs[connId];
    delete _activeFileTab[connId];
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
let _filePages = {}; // 每个连接的当前页码

// 判断文件是否可编辑（纯文本类型）
const _editableExtensions = new Set([
  '.txt', '.log', '.md', '.csv', '.tsv',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.py', '.js', '.ts', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.rs', '.rb', '.php', '.pl', '.lua', '.swift', '.kt', '.scala',
  '.r', '.m', '.cs', '.vb', '.dart', '.ex', '.exs', '.hs', '.ml',
  '.conf', '.cfg', '.ini', '.yaml', '.yml', '.toml', '.json', '.xml',
  '.env', '.properties', '.plist', '.htaccess',
  '.html', '.htm', '.css', '.scss', '.less', '.vue', '.jsx', '.tsx', '.svelte',
  '.sql',
  '.service', '.timer', '.socket', '.mount', '.target',
  '.nginx', '.dockerfile',
  '.gitignore', '.editorconfig', '.eslintrc', '.prettierrc',
  '.makefile', '.cmake', '.gradle', '.sbt',
]);

function isEditableFile(fileName) {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) {
    const noExtNames = ['makefile', 'dockerfile', 'vagrantfile', 'gemfile', 'rakefile', 'procfile', 'readme', 'license', 'changelog', 'authors', 'todo'];
    return noExtNames.includes(lower);
  }
  const ext = lower.substring(dotIdx);
  return _editableExtensions.has(ext);
}

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

  // 统计
  const dirCount = files.filter(f => f.isDir).length;
  const fileCount = files.filter(f => !f.isDir).length;

  // 分页
  const pageSize = 25;
  const totalPages = Math.ceil(files.length / pageSize) || 1;
  if (!_filePages[connId]) _filePages[connId] = 1;
  let currentPage = _filePages[connId];
  if (currentPage > totalPages) currentPage = 1;
  _filePages[connId] = currentPage;

  const startIdx = (currentPage - 1) * pageSize;
  const pageFiles = files.slice(startIdx, startIdx + pageSize);

  let html = '';

  // 上级目录（只在第一页显示）
  if (path !== '/' && currentPage === 1) {
    html += `<div class="term-file-item" data-action="nav-dir" data-conn="${connId}" data-path="${path}/..">
      <span class="term-file-icon">📁</span>
      <span class="term-file-name">..</span>
    </div>`;
  }

  for (const f of pageFiles) {
    const icon = f.isDir ? '📁' : '📄';
    const size = f.isDir ? '' : formatFileSize(f.size);
    const itemPath = path === '/' ? '/' + f.name : path + '/' + f.name;
    if (f.isDir) {
      html += `<div class="term-file-item" data-action="nav-dir" data-conn="${connId}" data-path="${itemPath}" data-name="${escapeHtml(f.name)}" data-isdir="true" data-filepath="${itemPath}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    } else {
      const editable = isEditableFile(f.name);
      const fileAction = editable ? 'data-action="open-text-file"' : '';
      html += `<div class="term-file-item ${editable ? 'term-file-clickable' : ''}" ${fileAction} data-name="${escapeHtml(f.name)}" data-isdir="false" data-filepath="${itemPath}" data-conn="${connId}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    }
  }

  // 顶部信息栏：统计 + 搜索 + 分页
  const pagerEl = document.getElementById(`filepager-${connId}`);
  if (pagerEl) {
    let pagerHtml = `<div class="term-file-stats-line">${fileCount} 个文件，${dirCount} 个文件夹</div>`;
    if (totalPages > 1) {
      pagerHtml += `<div class="term-file-pages">`;
      pagerHtml += `<button class="term-page-btn" data-action="file-page" data-conn="${connId}" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;

      // 智能分页：最多显示 5 个页码按钮
      const maxVisible = 5;
      let pages = [];
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (currentPage <= 3) { start = 2; end = maxVisible - 1; }
        if (currentPage >= totalPages - 2) { start = totalPages - maxVisible + 2; end = totalPages - 1; }
        if (start > 2) pages.push(-1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push(-1);
        pages.push(totalPages);
      }

      for (const p of pages) {
        if (p === -1) {
          pagerHtml += `<span class="term-page-ellipsis">…</span>`;
        } else {
          pagerHtml += `<button class="term-page-btn ${p === currentPage ? 'active' : ''}" data-action="file-page" data-conn="${connId}" data-page="${p}">${p}</button>`;
        }
      }

      pagerHtml += `<button class="term-page-btn" data-action="file-page" data-conn="${connId}" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
      pagerHtml += `</div>`;
    }
    pagerHtml += `<input type="text" class="term-file-search" id="filesearch-${connId}" placeholder="搜索文件..." data-conn="${connId}">`;
    pagerEl.innerHTML = pagerHtml;

    // 绑定搜索事件
    const searchInput = document.getElementById(`filesearch-${connId}`);
    searchInput?.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      filterFileList(connId, query);
    });
  }

  listEl.innerHTML = html;

  // 保存文件数据用于翻页和搜索
  listEl._filesData = { path, files };
}

// 切换文件列表页码
function filePageChange(connId, page) {
  _filePages[connId] = parseInt(page);
  const listEl = document.getElementById(`filelist-${connId}`);
  if (listEl && listEl._filesData) {
    renderFileList(connId, listEl._filesData.path, listEl._filesData.files);
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

// 搜索过滤文件列表
function filterFileList(connId, query) {
  const listEl = document.getElementById(`filelist-${connId}`);
  if (!listEl || !listEl._filesData) return;

  const { path, files } = listEl._filesData;

  if (!query) {
    // 清空搜索，恢复正常分页显示
    renderFileList(connId, path, files);
    return;
  }

  // 过滤匹配的文件
  const filtered = files.filter(f => f.name.toLowerCase().includes(query));

  let html = '';
  for (const f of filtered) {
    const icon = f.isDir ? '📁' : '📄';
    const size = f.isDir ? '' : formatFileSize(f.size);
    const itemPath = path === '/' ? '/' + f.name : path + '/' + f.name;
    if (f.isDir) {
      html += `<div class="term-file-item" data-action="nav-dir" data-conn="${connId}" data-path="${itemPath}" data-name="${escapeHtml(f.name)}" data-isdir="true" data-filepath="${itemPath}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    } else {
      const editable = isEditableFile(f.name);
      const fileAction = editable ? 'data-action="open-text-file"' : '';
      html += `<div class="term-file-item ${editable ? 'term-file-clickable' : ''}" ${fileAction} data-name="${escapeHtml(f.name)}" data-isdir="false" data-filepath="${itemPath}" data-conn="${connId}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    }
  }

  if (filtered.length === 0) {
    html = `<div class="term-file-error">无匹配结果</div>`;
  }

  listEl.innerHTML = html;
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
  _filePages[connId] = 1; // 切换目录重置页码
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
    const statusEl = document.getElementById(`uploadstatus-${connId}`);

    for (const file of input.files) {
      uploadSingleFile(conn, connId, path, file, statusEl);
    }
    input.value = '';
  };
}

// 上传单个文件（分片上传，真实进度）
function uploadSingleFile(conn, connId, remotePath, file, statusEl) {
  const itemId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const itemHtml = `<div class="term-upload-item" id="${itemId}">
    <div class="upload-item-info">
      <span class="upload-item-name">${escapeHtml(file.name)}</span>
      <div class="upload-item-stats">
        <span class="upload-item-percent" id="pct-${itemId}">0%</span>
        <span class="upload-item-speed" id="spd-${itemId}">--</span>
      </div>
    </div>
    <div class="upload-item-bar"><div class="upload-item-progress" id="prog-${itemId}"></div></div>
  </div>`;
  statusEl.insertAdjacentHTML('beforeend', itemHtml);

  const server = _servers.find(s => s.id === conn.serverId);
  if (!server) return;

  const host = server.wsUrl || server.host;
  const chunkSize = 1024 * 1024; // 1MB per chunk
  const totalChunks = Math.ceil(file.size / chunkSize);
  let currentChunk = 0;
  let failed = false;
  let startTime = Date.now();
  let lastTime = startTime;
  let lastBytes = 0;

  function uploadNextChunk() {
    if (failed) return;
    if (currentChunk >= totalChunks) {
      // 全部上传完成
      const pctEl = document.getElementById(`pct-${itemId}`);
      const progEl = document.getElementById(`prog-${itemId}`);
      if (pctEl) { pctEl.textContent = '完成'; pctEl.style.color = '#4caf50'; }
      if (progEl) progEl.style.background = '#4caf50';
      setTimeout(() => document.getElementById(itemId)?.remove(), 5000);
      // 刷新文件列表
      setTimeout(() => {
        const curPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify({ type: 'listDir', path: curPath }));
        }
      }, 500);
      return;
    }

    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('host', host);
    formData.append('port', String(server.port || 22));
    formData.append('username', server.username);
    formData.append('password', server.password);
    formData.append('path', remotePath);
    formData.append('chunk', String(currentChunk));
    formData.append('totalChunks', String(totalChunks));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:18022/upload');

    xhr.onload = () => {
      if (xhr.status === 200) {
        currentChunk++;
        const uploadedBytes = currentChunk * chunkSize;
        const percent = Math.round((currentChunk / totalChunks) * 100);

        // 计算速率
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        const bytesThisChunk = chunkSize;
        let speed = '';
        if (elapsed > 0) {
          const bps = bytesThisChunk / elapsed;
          speed = formatFileSize(Math.round(bps)) + '/s';
        }
        lastTime = now;
        lastBytes = uploadedBytes;

        const progEl = document.getElementById(`prog-${itemId}`);
        const pctEl = document.getElementById(`pct-${itemId}`);
        const spdEl = document.getElementById(`spd-${itemId}`);
        if (progEl) progEl.style.width = percent + '%';
        if (pctEl) pctEl.textContent = percent + '%';
        if (spdEl) spdEl.textContent = speed;
        uploadNextChunk();
      } else {
        failed = true;
        const pctEl = document.getElementById(`pct-${itemId}`);
        const progEl = document.getElementById(`prog-${itemId}`);
        if (pctEl) { pctEl.textContent = '失败'; pctEl.style.color = '#e57373'; }
        if (progEl) progEl.style.background = '#e57373';
        setTimeout(() => document.getElementById(itemId)?.remove(), 5000);
      }
    };

    xhr.onerror = () => {
      failed = true;
      const pctEl = document.getElementById(`pct-${itemId}`);
      const progEl = document.getElementById(`prog-${itemId}`);
      if (pctEl) { pctEl.textContent = '失败'; pctEl.style.color = '#e57373'; }
      if (progEl) progEl.style.background = '#e57373';
      setTimeout(() => document.getElementById(itemId)?.remove(), 5000);
    };

    xhr.send(formData);
  }

  uploadNextChunk();
}

// 文件右键菜单
let _fileContextMenu = null;
let _fileContextData = null;

function showFileContextMenu(e, connId, filePath, fileName, isDir) {
  e.preventDefault();
  _fileContextData = { connId, filePath, fileName, isDir };

  if (!_fileContextMenu) {
    _fileContextMenu = document.createElement('div');
    _fileContextMenu.className = 'file-context-menu';
    _fileContextMenu.innerHTML = `
      <button class="file-ctx-item" data-action="ctx-download"><span>📥</span> 下载</button>
      <button class="file-ctx-item" data-action="ctx-rename"><span>✏️</span> 重命名</button>
    `;
    document.body.appendChild(_fileContextMenu);

    document.addEventListener('click', () => hideFileContextMenu());
  }

  // 文件夹不显示下载 → 改为都显示
  // const dlBtn = _fileContextMenu.querySelector('[data-action="ctx-download"]');
  // dlBtn.style.display = isDir === 'true' ? 'none' : '';

  _fileContextMenu.style.display = 'block';
  _fileContextMenu.style.left = e.clientX + 'px';
  _fileContextMenu.style.top = e.clientY + 'px';

  // 确保不超出视口
  const rect = _fileContextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    _fileContextMenu.style.left = (e.clientX - rect.width) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    _fileContextMenu.style.top = (e.clientY - rect.height) + 'px';
  }
}

function hideFileContextMenu() {
  if (_fileContextMenu) {
    _fileContextMenu.style.display = 'none';
  }
  _fileContextData = null;
}

// 下载文件
function downloadFile() {
  if (!_fileContextData) return;
  const { connId, filePath, fileName, isDir } = _fileContextData;
  const conn = _connections.find(c => c.id === connId);
  if (!conn) return;

  // 通过 HTTP 下载接口
  const server = _servers.find(s => s.id === conn.serverId);
  if (!server) return;

  const host = server.wsUrl || server.host;
  const downloadUrl = `http://localhost:18022/download?host=${encodeURIComponent(host)}&port=${server.port || 22}&username=${encodeURIComponent(server.username)}&password=${encodeURIComponent(server.password)}&path=${encodeURIComponent(filePath)}&isDir=${isDir}`;

  // 用隐藏的 a 标签触发下载
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = isDir === 'true' ? fileName + '.tar.gz' : fileName;
  a.click();

  hideFileContextMenu();
}

// 重命名
function renameFile() {
  if (!_fileContextData) return;
  const { connId, filePath, fileName } = _fileContextData;
  const newName = prompt('重命名', fileName);
  if (!newName || newName === fileName) {
    hideFileContextMenu();
    return;
  }
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

  // 计算新路径
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  const newPath = dir + '/' + newName;
  conn.ws.send(JSON.stringify({ type: 'rename', path: filePath, data: newPath }));
  hideFileContextMenu();
}

// 分割条拖动
function initTermSplitter(connId, fitAddon) {
  const splitter = document.getElementById(`splitter-${connId}`);
  const filePanel = document.getElementById(`files-${connId}`);
  if (!splitter || !filePanel) return;

  let isDragging = false;

  splitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const layout = filePanel.parentElement;
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const minW = 150;
    const maxW = 500;
    if (newWidth >= minW && newWidth <= maxW) {
      filePanel.style.width = newWidth + 'px';
      fitAddon.fit();
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      fitAddon.fit();
    }
  });
}

// 拖拽上传
function initDragUpload(connId) {
  const filePanel = document.getElementById(`files-${connId}`);
  if (!filePanel) return;

  filePanel.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    filePanel.classList.add('drag-over');
  });

  filePanel.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    filePanel.classList.remove('drag-over');
  });

  filePanel.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    filePanel.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const conn = _connections.find(c => c.id === connId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

    const path = document.getElementById(`filepath-${connId}`)?.textContent || '.';
    const statusEl = document.getElementById(`uploadstatus-${connId}`);

    for (const file of files) {
      uploadSingleFile(conn, connId, path, file, statusEl);
    }
  });
}

// escapeHtml imported from utils

// initTerminal 由 main.ts 调用

// ========== 文件查看器功能 ==========
let _fileTabs = {};
let _activeFileTab = {};

function openTextFile(connId, filePath, fileName) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

  if (!_fileTabs[connId]) _fileTabs[connId] = [];

  const existing = _fileTabs[connId].find(t => t.path === filePath);
  if (existing) {
    _activeFileTab[connId] = existing.id;
    renderFileViewer(connId);
    return;
  }

  conn.ws.send(JSON.stringify({ type: 'readFile', path: filePath }));

  const tabId = 'ftab_' + Date.now();
  _fileTabs[connId].push({ id: tabId, name: fileName, path: filePath, content: null, loading: true, modified: false });
  _activeFileTab[connId] = tabId;
  renderFileViewer(connId);
}

function handleFileContent(connId, filePath, content) {
  if (!_fileTabs[connId]) return;
  const tab = _fileTabs[connId].find(t => t.path === filePath);
  if (tab) {
    tab.content = content;
    tab.loading = false;
    renderFileViewer(connId);
  }
}

function closeFileTab(connId, tabId) {
  if (!_fileTabs[connId]) return;
  const idx = _fileTabs[connId].findIndex(t => t.id === tabId);
  if (idx === -1) return;

  _fileTabs[connId].splice(idx, 1);

  if (_activeFileTab[connId] === tabId) {
    if (_fileTabs[connId].length > 0) {
      const newIdx = Math.min(idx, _fileTabs[connId].length - 1);
      _activeFileTab[connId] = _fileTabs[connId][newIdx].id;
    } else {
      _activeFileTab[connId] = null;
    }
  }

  renderFileViewer(connId);
}

function switchFileTab(connId, tabId) {
  const currentTabId = _activeFileTab[connId];
  if (currentTabId && _fileTabs[connId]) {
    const currentTab = _fileTabs[connId].find(t => t.id === currentTabId);
    const editor = document.getElementById(`fveditor-${connId}`);
    if (currentTab && editor && !currentTab.loading) {
      currentTab.content = editor.value;
    }
  }

  _activeFileTab[connId] = tabId;
  renderFileViewer(connId);
}

// 根据文件名获取语言类型
function getFileLang(fileName) {
  if (!fileName) return 'text';
  const lower = fileName.toLowerCase();
  const ext = lower.substring(lower.lastIndexOf('.'));
  const map = {
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell', '.fish': 'shell',
    '.py': 'python',
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'javascript', '.tsx': 'javascript',
    '.go': 'go',
    '.java': 'java', '.kt': 'java', '.scala': 'java',
    '.c': 'c', '.cpp': 'c', '.h': 'c', '.hpp': 'c', '.cs': 'c', '.rs': 'c',
    '.rb': 'ruby',
    '.php': 'php',
    '.lua': 'lua',
    '.sql': 'sql',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml', '.html': 'xml', '.htm': 'xml', '.svg': 'xml',
    '.css': 'css', '.scss': 'css', '.less': 'css',
    '.ini': 'ini', '.conf': 'ini', '.cfg': 'ini', '.properties': 'ini',
    '.toml': 'toml',
    '.md': 'markdown',
    '.dockerfile': 'docker',
    '.nginx': 'nginx',
  };
  if (lower === 'dockerfile' || lower === 'makefile') return 'shell';
  return map[ext] || 'text';
}

// 语法高亮（逐行处理，避免跨行 span 导致错位）
function highlightCode(code, lang) {
  if (lang === 'text' || lang === 'csv') return escapeHtml(code);

  const lines = code.split('\n');
  return lines.map(line => highlightLine(escapeHtml(line), lang)).join('\n');
}

function highlightLine(line, lang) {
  if (lang === 'shell') {
    // 注释（整行）
    if (/^\s*#/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/(\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9#@?!$*-])/g, '<span class="hl-variable">$1</span>');
    line = line.replace(/\b(function|if|then|else|elif|fi|for|do|done|while|until|case|esac|in|return|exit|local|export|source|alias|unset|readonly|declare|typeset|shift|trap|eval|exec|set)\b/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(echo|printf|cd|ls|cat|grep|awk|sed|find|xargs|chmod|chown|mkdir|rm|cp|mv|ln|tar|gzip|curl|wget|ssh|scp|kill|ps|top|df|du|mount|umount|systemctl|service|apt|yum|dnf|pip|npm|docker)\b/g, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'python') {
    if (/^\s*#/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|pass|break|continue|raise|lambda|and|or|not|in|is|True|False|None|self|async|await|global|nonlocal)\b/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|type|isinstance|open|input|super|map|filter|zip|enumerate|sorted|reversed|abs|min|max|sum|any|all|hasattr|getattr|setattr)\b/g, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'javascript') {
    if (/^\s*\/\//.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(\/\/[^\n]*)$/g, '<span class="hl-comment">$1</span>');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;|`[^`]*`)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(function|const|let|var|if|else|for|while|do|switch|case|break|continue|return|class|extends|new|this|super|import|export|from|default|try|catch|finally|throw|async|await|yield|typeof|instanceof|in|of|delete|void|null|undefined|true|false)\b/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(console|Math|JSON|Object|Array|String|Number|Boolean|Promise|Map|Set|RegExp|Date|Error|setTimeout|setInterval|fetch|require|module)\b/g, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'go') {
    if (/^\s*\/\//.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(\/\/[^\n]*)$/g, '<span class="hl-comment">$1</span>');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough|nil|true|false|make|new|append|len|cap|delete|close|panic|recover)\b/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(fmt|log|os|io|net|http|json|strings|strconv|sync|time|context|errors|math|sort|bytes|bufio|regexp)\b/g, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'java' || lang === 'c') {
    if (/^\s*\/\//.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(\/\/[^\n]*)$/g, '<span class="hl-comment">$1</span>');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(public|private|protected|static|final|abstract|class|interface|extends|implements|new|this|super|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|import|package|void|int|long|float|double|boolean|char|byte|short|String|null|true|false|enum|struct|typedef|sizeof|unsigned|signed|const|volatile|extern|register|auto|include|define|ifdef|ifndef|endif|pragma)\b/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(\d+\.?\d*[fFdDlL]?)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'sql') {
    if (/^\s*--/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(--[^\n]*)$/g, '<span class="hl-comment">$1</span>');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|EXISTS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|CHECK|UNIQUE|AUTO_INCREMENT|CASCADE|TRUNCATE|IF|FUNCTION|PROCEDURE|TRIGGER|DATABASE|SCHEMA|USE|SHOW|DESCRIBE|EXPLAIN)\b/gi, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'yaml') {
    if (/^\s*#/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/^( *[A-Za-z_][A-Za-z0-9_.-]*)(:)/g, '<span class="hl-keyword">$1</span>$2');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(true|false|null|yes|no)\b/gi, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'json') {
    line = line.replace(/(&quot;[^&quot;]*&quot;)\s*:/g, '<span class="hl-keyword">$1</span>:');
    line = line.replace(/:(\s*&quot;[^&quot;]*&quot;)/g, ':<span class="hl-string">$1</span>');
    line = line.replace(/\b(true|false|null)\b/g, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'xml') {
    if (/&lt;!--/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(&lt;\/?[A-Za-z][A-Za-z0-9_:-]*)/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/\s([A-Za-z_][A-Za-z0-9_:-]*)=/g, ' <span class="hl-builtin">$1</span>=');
    line = line.replace(/(=&quot;[^&quot;]*&quot;|=&#x27;[^&#x27;]*&#x27;)/g, '<span class="hl-string">$1</span>');
  } else if (lang === 'css') {
    line = line.replace(/([.#]?[A-Za-z_-][A-Za-z0-9_-]*)(\s*\{)/g, '<span class="hl-keyword">$1</span>$2');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms)?)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'ini' || lang === 'toml') {
    if (/^\s*[#;]/.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(\[[^\]]+\])/g, '<span class="hl-keyword">$1</span>');
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(true|false)\b/gi, '<span class="hl-builtin">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  } else if (lang === 'markdown') {
    if (/^#{1,6}\s/.test(line)) return '<span class="hl-keyword">' + line + '</span>';
    line = line.replace(/(`[^`]+`)/g, '<span class="hl-string">$1</span>');
  } else {
    if (/^\s*[#]/.test(line) || /^\s*\/\//.test(line)) return '<span class="hl-comment">' + line + '</span>';
    line = line.replace(/(&#x27;[^&#x27;]*&#x27;|&quot;[^&quot;]*&quot;)/g, '<span class="hl-string">$1</span>');
    line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');
  }

  return line;
}

function renderFileViewer(connId) {
  const panel = document.getElementById(`panel-${connId}`);
  if (!panel) return;

  const tabs = _fileTabs[connId] || [];
  const termArea = document.getElementById(`termarea-${connId}`);
  let viewerContainer = document.getElementById(`fileviewer-${connId}`);
  let hSplitter = document.getElementById(`hsplitter-${connId}`);

  if (tabs.length === 0) {
    if (viewerContainer) viewerContainer.remove();
    if (hSplitter) hSplitter.remove();
    if (termArea) termArea.style.flex = '1';
    const conn = _connections.find(c => c.id === connId);
    if (conn) setTimeout(() => conn.fitAddon.fit(), 50);
    return;
  }

  const termWrapper = document.getElementById(`termwrapper-${connId}`);
  if (!termWrapper) return;

  if (!viewerContainer) {
    viewerContainer = document.createElement('div');
    viewerContainer.id = `fileviewer-${connId}`;
    viewerContainer.className = 'term-file-viewer';
    termWrapper.insertBefore(viewerContainer, termWrapper.firstChild);

    hSplitter = document.createElement('div');
    hSplitter.id = `hsplitter-${connId}`;
    hSplitter.className = 'term-hsplitter';
    termWrapper.insertBefore(hSplitter, termArea);

    initHSplitter(connId);
  }

  const activeTabId = _activeFileTab[connId];
  const activeTab = tabs.find(t => t.id === activeTabId);

  let tabsHtml = tabs.map(t => {
    const modified = t.modified ? ' modified' : '';
    return `<div class="fv-tab ${t.id === activeTabId ? 'active' : ''}${modified}" data-action="switch-file-tab" data-conn="${connId}" data-tabid="${t.id}">
      <span class="fv-tab-name" title="${escapeHtml(t.path)}">${escapeHtml(t.name)}${t.modified ? ' \u25cf' : ''}</span>
      <button class="fv-tab-close" data-action="close-file-tab" data-conn="${connId}" data-tabid="${t.id}">\u00d7</button>
    </div>`;
  }).join('');

  let contentHtml = '';
  if (activeTab) {
    if (activeTab.loading) {
      contentHtml = '<div class="fv-loading">\u52a0\u8f7d\u4e2d...</div>';
    } else {
      const lang = getFileLang(activeTab.name);
      const lineCount = (activeTab.content || '').split('\n').length;
      let lineNums = '';
      for (let i = 1; i <= lineCount; i++) {
        lineNums += i + '\n';
      }
      contentHtml = `<div class="fv-editor-wrap">
        <div class="fv-gutter" id="fvgutter-${connId}"><pre class="fv-line-numbers">${lineNums}</pre></div>
        <div class="fv-code-area" id="fvcodearea-${connId}">
          <pre class="fv-highlight" id="fvhighlight-${connId}">${highlightCode(activeTab.content || '', lang)}\n</pre>
          <textarea class="fv-editor" id="fveditor-${connId}" spellcheck="false">${escapeHtml(activeTab.content || '')}</textarea>
        </div>
      </div>`;
    }
  }

  viewerContainer.innerHTML = `
    <div class="fv-tabs">${tabsHtml}</div>
    <div class="fv-toolbar">
      <button class="fv-toolbar-btn" data-action="save-file" data-conn="${connId}" title="\u4fdd\u5b58 (Ctrl+S)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      </button>
      <button class="fv-toolbar-btn" data-action="refresh-file" data-conn="${connId}" title="\u5237\u65b0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </button>
    </div>
    <div class="fv-body">${contentHtml}</div>
  `;

  const editor = document.getElementById(`fveditor-${connId}`);
  if (editor && activeTab && !activeTab.loading) {
    const highlightEl = document.getElementById(`fvhighlight-${connId}`);
    const gutterEl = document.getElementById(`fvgutter-${connId}`);
    const lang = getFileLang(activeTab.name);

    // 同步滚动 - 用 transform 避免 scrollTop 赋值的延迟错位
    let ticking = false;
    editor.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (highlightEl) {
            highlightEl.style.transform = `translate(-${editor.scrollLeft}px, -${editor.scrollTop}px)`;
          }
          if (gutterEl) {
            gutterEl.scrollTop = editor.scrollTop;
          }
          ticking = false;
        });
        ticking = true;
      }
    });

    editor.addEventListener('input', () => {
      // 更新高亮
      if (highlightEl) {
        highlightEl.innerHTML = highlightCode(editor.value, lang) + '\n';
      }
      // 更新行号
      if (gutterEl) {
        const lineCount = editor.value.split('\n').length;
        let lineNums = '';
        for (let i = 1; i <= lineCount; i++) {
          lineNums += i + '\n';
        }
        gutterEl.querySelector('.fv-line-numbers').textContent = lineNums;
      }
      if (activeTab && !activeTab.modified) {
        activeTab.modified = true;
        const tabEl = viewerContainer.querySelector('.fv-tab.active .fv-tab-name');
        if (tabEl && !tabEl.textContent.endsWith(' \u25cf')) {
          tabEl.textContent = activeTab.name + ' \u25cf';
        }
        const tabDiv = viewerContainer.querySelector('.fv-tab.active');
        if (tabDiv) tabDiv.classList.add('modified');
      }
    });

    editor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile(connId);
      }
      // Tab 键插入空格
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        editor.dispatchEvent(new Event('input'));
      }
    });
  }

  const conn = _connections.find(c => c.id === connId);
  if (conn) setTimeout(() => conn.fitAddon.fit(), 50);
}

function saveFile(connId) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

  const activeTabId = _activeFileTab[connId];
  if (!activeTabId || !_fileTabs[connId]) return;
  const tab = _fileTabs[connId].find(t => t.id === activeTabId);
  if (!tab) return;

  const editor = document.getElementById(`fveditor-${connId}`);
  if (!editor) return;

  const content = editor.value;
  conn.ws.send(JSON.stringify({ type: 'writeFile', path: tab.path, data: content }));

  tab.content = content;
  tab.modified = false;

  const viewerContainer = document.getElementById(`fileviewer-${connId}`);
  if (viewerContainer) {
    const tabEl = viewerContainer.querySelector('.fv-tab.active .fv-tab-name');
    if (tabEl) tabEl.textContent = tab.name;
    const tabDiv = viewerContainer.querySelector('.fv-tab.active');
    if (tabDiv) tabDiv.classList.remove('modified');
  }

  showFileToast('\u4fdd\u5b58\u6210\u529f');
}

function refreshFile(connId) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

  const activeTabId = _activeFileTab[connId];
  if (!activeTabId || !_fileTabs[connId]) return;
  const tab = _fileTabs[connId].find(t => t.id === activeTabId);
  if (!tab) return;

  if (tab.modified) {
    if (!confirm('\u6587\u4ef6\u5df2\u4fee\u6539\uff0c\u5237\u65b0\u5c06\u4e22\u5931\u672a\u4fdd\u5b58\u7684\u66f4\u6539\uff0c\u786e\u5b9a\u5237\u65b0\uff1f')) return;
  }

  tab.loading = true;
  tab.modified = false;
  renderFileViewer(connId);
  conn.ws.send(JSON.stringify({ type: 'readFile', path: tab.path }));
}

function showFileToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fv-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

function initHSplitter(connId) {
  const hSplitter = document.getElementById(`hsplitter-${connId}`);
  const viewer = document.getElementById(`fileviewer-${connId}`);
  const termWrapper = document.getElementById(`termwrapper-${connId}`);
  if (!hSplitter || !viewer || !termWrapper) return;

  let isDragging = false;

  hSplitter.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = termWrapper.getBoundingClientRect();
    const newHeight = e.clientY - rect.top;
    const minH = 100;
    const maxH = rect.height - 150;
    if (newHeight >= minH && newHeight <= maxH) {
      viewer.style.height = newHeight + 'px';
      viewer.style.flex = 'none';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const conn = _connections.find(c => c.id === connId);
      if (conn) conn.fitAddon.fit();
    }
  });
}

// 切换文件列表面板显示/隐藏
function toggleFilePanel(connId) {
  const filePanel = document.getElementById(`files-${connId}`);
  const splitter = document.getElementById(`splitter-${connId}`);
  const toggleBtn = document.getElementById(`filetoggle-${connId}`);
  if (!filePanel) return;

  const isHidden = filePanel.classList.toggle('hidden');
  if (splitter) splitter.classList.toggle('hidden', isHidden);
  if (toggleBtn) toggleBtn.classList.toggle('visible', isHidden);

  // 重新 fit 终端
  const conn = _connections.find(c => c.id === connId);
  if (conn) setTimeout(() => conn.fitAddon.fit(), 50);
}

// ========== 批量执行命令 ==========

function openBatchExec() {
  const checked = document.querySelectorAll('.terminal-server-list .server-checkbox:checked');
  const serverIds = Array.from(checked).map(cb => cb.dataset.id);

  if (serverIds.length === 0) {
    alert('\u8bf7\u5148\u52fe\u9009\u8981\u8fde\u63a5\u7684\u670d\u52a1\u5668');
    return;
  }

  const targets = serverIds.map(id => _servers.find(s => s.id === id)).filter(Boolean);

  // 创建批量终端 tab
  const batchId = 'batch_' + Date.now();
  const termPanel = document.createElement('div');
  termPanel.id = `panel-${batchId}`;
  termPanel.className = 'terminal-panel';

  // 网格布局 + 底部命令输入
  termPanel.innerHTML = `
    <div class="batch-terminal-panel">
      <div class="batch-terminal-grid" id="batchGrid-${batchId}"></div>
      <div class="batch-input-bar">
        <span class="batch-input-label">\u25cf \u5168\u90e8</span>
        <button class="batch-input-btn" id="batchClearBtn-${batchId}" title="Ctrl+C">Ctrl+C</button>
        <input type="text" class="batch-input-cmd" id="batchInput-${batchId}" placeholder="\u8f93\u5165\u547d\u4ee4\uff0c\u540c\u65f6\u53d1\u9001\u5230\u6240\u6709\u7ec8\u7aef..." spellcheck="false">
        <button class="batch-input-btn" id="batchUploadBtn-${batchId}" title="\u4e0a\u4f20\u6587\u4ef6\u5230\u6240\u6709\u670d\u52a1\u5668"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
        <input type="file" id="batchFileInput-${batchId}" style="display:none" multiple>
        <button class="batch-input-send" id="batchSendBtn-${batchId}">\u53d1\u9001</button>
      </div>
    </div>
  `;
  document.getElementById('terminalBody').appendChild(termPanel);

  const conn = {
    id: batchId,
    panel: termPanel,
    name: '\u26a1 \u6279\u91cf(' + targets.length + ')',
    _isBatch: true,
    _batchConns: []
  };
  _connections.push(conn);
  switchTab(batchId);

  // 为每台服务器创建终端格子
  const gridEl = document.getElementById(`batchGrid-${batchId}`);
  for (const server of targets) {
    const cellId = `bcell-${batchId}-${server.id}`;
    const cell = document.createElement('div');
    cell.className = 'batch-terminal-cell';
    cell.id = `batchcell-${batchId}-${server.id}`;
    cell.innerHTML = `
      <div class="batch-cell-header">
        <span class="batch-cell-name">${escapeHtml(server.name)}</span>
        <span class="batch-cell-host">${escapeHtml(server.host || server.wsUrl || '')}</span>
        <button class="batch-cell-btn batch-cell-close" data-action="batch-cell-close" data-batch="${batchId}" data-server="${server.id}" title="\u5173\u95ed">\u00d7</button>
      </div>
      <div class="batch-cell-term" id="${cellId}"></div>
    `;
    gridEl.appendChild(cell);

    // 创建 xterm 实例
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#111111',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78'
      }
    });
    const fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(document.getElementById(cellId));
    setTimeout(() => fitAddon.fit(), 100);

    // 连接 WebSocket
    const host = server.wsUrl || server.host;
    let ws;
    try {
      ws = new WebSocket('ws://localhost:18022/ws');
    } catch(e) {
      terminal.writeln('\x1b[31mWebSocket failed\x1b[0m');
      continue;
    }

    const batchConn = { serverId: server.id, ws, terminal, fitAddon, server };
    conn._batchConns.push(batchConn);

    ws.onopen = () => {
      terminal.writeln('\x1b[33mConnecting...\x1b[0m');
      setTimeout(() => {
        const dims = fitAddon.proposeDimensions();
        const useKey = server.authType === 'key' && server.privateKey;
        const connectMsg = {
          type: 'connect',
          host: host,
          port: server.port || 22,
          username: server.username,
          cols: dims?.cols || 80,
          rows: dims?.rows || 24
        };
        if (useKey) {
          connectMsg.key = server.privateKey;
          if (server.keyPassphrase) connectMsg.password = server.keyPassphrase;
        } else {
          connectMsg.password = server.password;
        }
        ws.send(JSON.stringify(connectMsg));
      }, 200);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        switch (msg.type) {
          case 'connected':
            terminal.writeln('\x1b[32mConnected!\x1b[0m\r\n');
            break;
          case 'output':
            terminal.write(msg.data);
            break;
          case 'error':
            terminal.writeln('\x1b[31m' + msg.data + '\x1b[0m');
            break;
          case 'disconnect':
            terminal.writeln('\r\n\x1b[33m' + (msg.data || 'Disconnected') + '\x1b[0m');
            break;
        }
      } catch(err) {}
    };

    ws.onclose = () => {
      try { terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m'); } catch(e) {}
    };

    // 终端输入 → 发送到 WebSocket
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });
  }

  // 绑定输入框事件
  const inputEl = document.getElementById(`batchInput-${batchId}`);
  const sendBtn = document.getElementById(`batchSendBtn-${batchId}`);
  const clearBtn = document.getElementById(`batchClearBtn-${batchId}`);

  const sendCommand = () => {
    const cmd = inputEl.value;
    if (!cmd) return;
    for (const bc of conn._batchConns) {
      if (bc.ws.readyState === WebSocket.OPEN) {
        bc.ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' }));
      }
    }
    inputEl.value = '';
    inputEl.focus();
  };

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendCommand();
    }
  });

  sendBtn.addEventListener('click', sendCommand);

  clearBtn.addEventListener('click', () => {
    for (const bc of conn._batchConns) {
      if (bc.ws.readyState === WebSocket.OPEN) {
        bc.ws.send(JSON.stringify({ type: 'input', data: '\x03' }));
      }
    }
  });

  // 上传文件到所有服务器
  const uploadBtn = document.getElementById(`batchUploadBtn-${batchId}`);
  const batchFileInput = document.getElementById(`batchFileInput-${batchId}`);

  uploadBtn.addEventListener('click', () => {
    batchFileInput.click();
  });

  batchFileInput.addEventListener('change', () => {
    if (!batchFileInput.files || batchFileInput.files.length === 0) return;
    const files = Array.from(batchFileInput.files);
    // 每台服务器独立上传（内部串行分片，不会占大量内存）
    for (const bc of conn._batchConns) {
      const server = bc.server;
      const cellEl = document.getElementById(`batchcell-${batchId}-${server.id}`);
      for (const file of files) {
        batchUploadFile(null, 0, null, null, '/tmp', file, bc.terminal, cellEl, bc.ws, server);
      }
    }
    batchFileInput.value = '';
  });

  // 窗口 resize 时 fit 所有终端
  const resizeHandler = () => {
    if (_activeTabId === batchId) {
      for (const bc of conn._batchConns) {
        bc.fitAddon.fit();
        const dims = bc.fitAddon.proposeDimensions();
        if (dims && bc.ws.readyState === WebSocket.OPEN) {
          bc.ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      }
    }
  };
  window.addEventListener('resize', resizeHandler);
  conn._resizeHandler = resizeHandler;

  // 延迟 fit
  setTimeout(resizeHandler, 300);
}

function closeBatchExec() {
  document.getElementById('batchExecModal').style.display = 'none';
}

// 关闭批量终端中的单个窗口
function closeBatchCell(batchId, serverId) {
  const conn = _connections.find(c => c.id === batchId);
  if (!conn || !conn._batchConns) return;

  const idx = conn._batchConns.findIndex(bc => bc.serverId === serverId);
  if (idx === -1) return;

  const bc = conn._batchConns[idx];
  if (bc.ws && bc.ws.readyState === WebSocket.OPEN) {
    try { bc.ws.send(JSON.stringify({ type: 'disconnect' })); } catch(e) {}
    bc.ws.close();
  }
  bc.terminal.dispose();
  conn._batchConns.splice(idx, 1);

  // 移除 DOM
  const cellEl = document.getElementById(`batchcell-${batchId}-${serverId}`);
  if (cellEl) cellEl.remove();

  // 如果所有子连接都关了，关闭整个 tab
  if (conn._batchConns.length === 0) {
    closeConnection(batchId);
  }
}

// 批量终端上传文件
function batchUploadFile(host, port, username, password, remotePath, file, terminal, cellEl, ws, server) {
  // 在标题栏添加进度标签
  let progressEl = null;
  if (cellEl) {
    const header = cellEl.querySelector('.batch-cell-header');
    if (header) {
      progressEl = document.createElement('span');
      progressEl.className = 'batch-upload-progress';
      progressEl.textContent = '0%';
      header.appendChild(progressEl);
    }
  }

  const sHost = server.wsUrl || server.host;
  const sPort = server.port || 22;

  // 使用 HTTP 分片上传（复用服务端连接池），避免 base64 内存爆炸
  const chunkSize = 1024 * 1024; // 1MB
  const totalChunks = Math.ceil(file.size / chunkSize);
  let currentChunk = 0;

  function uploadNextChunk() {
    if (currentChunk >= totalChunks) {
      if (progressEl) {
        progressEl.textContent = '\u2714';
        progressEl.classList.add('done');
        setTimeout(() => progressEl.remove(), 3000);
      }
      terminal.writeln('\r\n\x1b[32mUpload OK: ' + remotePath + '/' + file.name + '\x1b[0m');
      return;
    }

    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('host', sHost);
    formData.append('port', String(sPort));
    formData.append('username', server.username);
    formData.append('password', server.password);
    formData.append('path', remotePath);
    formData.append('chunk', String(currentChunk));
    formData.append('totalChunks', String(totalChunks));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:18022/upload');

    xhr.onload = () => {
      if (xhr.status === 200) {
        currentChunk++;
        const pct = Math.round((currentChunk / totalChunks) * 100);
        if (progressEl) progressEl.textContent = pct + '%';
        uploadNextChunk();
      } else {
        if (progressEl) {
          progressEl.textContent = '\u2716';
          progressEl.classList.add('fail');
          setTimeout(() => progressEl.remove(), 3000);
        }
        terminal.writeln('\r\n\x1b[31mUpload failed at chunk ' + currentChunk + '\x1b[0m');
      }
    };

    xhr.onerror = () => {
      if (progressEl) {
        progressEl.textContent = '\u2716';
        progressEl.classList.add('fail');
        setTimeout(() => progressEl.remove(), 3000);
      }
      terminal.writeln('\r\n\x1b[31mUpload error\x1b[0m');
    };

    xhr.send(formData);
  }

  uploadNextChunk();
}

function runBatchExec() {
  // 保留旧的单次执行逻辑（不再使用，但保留兼容）
  closeBatchExec();
}

// ===== 导出 =====

export {
  initTerminal,
  connectServer,
  openAddServer,
  openEditServer,
  saveServer,
  deleteServer,
  closeServerModal,
  switchAuthType,
  switchTab,
  closeConnection,
  refreshFiles,
  navDir,
  uploadFile,
  filePageChange,
  downloadFile,
  renameFile,
  addGroup,
  deleteGroup,
  selectGroup,
  sortServers,
  saveGroup,
  closeGroupModal,
  ctxEditGroup,
  ctxDeleteGroup,
  openTextFile,
  closeFileTab,
  switchFileTab,
  saveFile,
  refreshFile,
  toggleFilePanel,
  openBatchExec,
  closeBatchExec,
  runBatchExec,
  closeBatchCell
};
