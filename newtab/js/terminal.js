/**
 * LinkHub New Tab - 终端模块
 * Tab 式布局：第一个 tab 固定为服务器列表，点击服务器新增终端 tab
 */

let _servers = [];
let _connections = [];
let _activeTabId = 'server-list';
let _connIdCounter = 0;
let _groups = [];         // 分组列表
let _selectedGroup = 'all'; // 当前选中的分组

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
    setTimeout(checkServersStatus, 30000);
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

  setTimeout(checkServersStatus, 30000);
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
  } catch (e) {}
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
  document.getElementById('serverRemark').value = '';
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
  document.getElementById('serverRemark').value = server.remark || '';
  updateGroupSelect();
  document.getElementById('serverGroup').value = server.group || '';
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
  const group = document.getElementById('serverGroup').value;

  if (!name || !wsUrl || !username) {
    alert('请填写名称、服务器地址和用户名');
    return;
  }

  if (id) {
    const idx = _servers.findIndex(s => s.id === id);
    if (idx >= 0) {
      _servers[idx] = { ..._servers[idx], name, wsUrl, port, username, password, remark, group, host: wsUrl };
    }
  } else {
    _servers.push({
      id: Date.now().toString(),
      name, wsUrl, port, username, password, remark, group, host: wsUrl
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
      <div class="term-file-panel" id="files-${connId}">
        <div class="term-file-header">
          <span class="term-file-path" id="filepath-${connId}">/</span>
          <button class="term-file-btn" data-action="upload-file" data-conn="${connId}" title="上传文件"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
          <input type="file" id="fileInput-${connId}" style="display:none" multiple>
        </div>
        <div class="term-file-pager-top" id="filepager-${connId}"></div>
        <div class="term-file-list" id="filelist-${connId}"></div>
        <div class="term-upload-status" id="uploadstatus-${connId}"></div>
      </div>
      <div class="term-splitter" id="splitter-${connId}"></div>
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
      background: '#111111',
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

  // 初始化分割条拖动
  initTermSplitter(connId, fitAddon);

  // WebSocket 事件
  ws.onopen = () => {
    terminal.writeln('\x1b[33mConnecting to ' + server.name + ' (' + host + ')...\x1b[0m');

    if (!server.password) {
      // 没有密码，进入密码输入模式
      terminal.writeln('\x1b[32m' + server.username + '@' + host + '\x1b[0m');
      terminal.write('Password: ');
      conn._waitingPassword = true;
      conn._passwordBuffer = '';
    } else {
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
    }
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'connected':
          terminal.writeln('\x1b[32mConnected!\x1b[0m\r\n');
          // 文件列表会由 Go 端 SFTP 准备好后自动推送
          // 请求系统信息
          ws.send(JSON.stringify({ type: 'getSysInfo' }));
          break;
        case 'sysInfo':
          // 保存系统信息到服务器数据
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
            } catch(e) {}
          }
          break;
        case 'output':
          terminal.write(msg.data);
          break;
        case 'error':
          // 文件操作错误不显示在终端
          if (msg.data && (msg.data.includes('list dir') || msg.data.includes('SFTP') || msg.data.includes('upload'))) {
            const listEl = document.getElementById(`filelist-${connId}`);
            if (listEl) listEl.innerHTML = `<div class="term-file-error">${msg.data}</div>`;
          } else if (msg.data && msg.data.includes('SSH connect failed')) {
            // SSH 连接失败（可能是密码错误），提示重新输入
            terminal.writeln('\x1b[31m' + msg.data + '\x1b[0m');
            terminal.writeln('');
            terminal.write('Password: ');
            conn._waitingPassword = true;
            conn._passwordBuffer = '';
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
        case 'renameOk':
          // 刷新文件列表
          const rPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
          ws.send(JSON.stringify({ type: 'listDir', path: rPath }));
          break;
      }
    } catch (err) {}
  };

  ws.onerror = () => {
    try { terminal.writeln('\x1b[31mWebSocket error\x1b[0m'); } catch(e) {}
  };

  ws.onclose = () => {
    try {
      terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
      terminal.writeln('\x1b[90mPress Enter to reconnect...\x1b[0m');
    } catch(e) {}
    // 标记连接已断开，等待用户按回车重连
    conn._disconnected = true;
  };

  // 终端输入
  let _inputBuffer = '';
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
        ws.send(JSON.stringify({
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

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));

      // 只在检测到 cd 命令时才刷新文件列表
      if (data === '\r' || data === '\n') {
        const cmd = _inputBuffer.trim();
        _inputBuffer = '';
        if (cmd === 'cd' || cmd.startsWith('cd ')) {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'getCwd' }));
            }
          }, 500);
        }
      } else if (data === '\x7f' || data === '\b') {
        _inputBuffer = _inputBuffer.slice(0, -1);
      } else if (data.length === 1 && data >= ' ') {
        _inputBuffer += data;
      } else if (data.length > 1 && !data.includes('\x1b')) {
        // 粘贴的文本
        _inputBuffer += data;
      }
    } else if (conn._disconnected && (data === '\r' || data === '\n')) {
      // 断开后按回车重连
      reconnect(connId);
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

// 重连
function reconnect(connId) {
  const conn = _connections.find(c => c.id === connId);
  if (!conn) return;
  const server = _servers.find(s => s.id === conn.serverId);
  if (!server) return;

  conn._disconnected = false;
  conn.terminal.writeln('\r\n\x1b[33mReconnecting...\x1b[0m');

  const host = server.wsUrl || server.host;
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
      newWs.send(JSON.stringify({
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

  newWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'connected':
          conn.terminal.writeln('\x1b[32mReconnected!\x1b[0m\r\n');
          newWs.send(JSON.stringify({ type: 'getSysInfo' }));
          break;
        case 'sysInfo':
          if (msg.data) {
            try {
              const info = JSON.parse(msg.data);
              if (server) {
                server._sysInfo = info;
                saveServers();
              }
            } catch(err) {}
          }
          break;
        case 'output':
          conn.terminal.write(msg.data);
          break;
        case 'error':
          if (msg.data && (msg.data.includes('list dir') || msg.data.includes('SFTP') || msg.data.includes('upload'))) {
            const listEl = document.getElementById(`filelist-${connId}`);
            if (listEl) listEl.innerHTML = `<div class="term-file-error">${msg.data}</div>`;
          } else {
            conn.terminal.writeln('\x1b[31mError: ' + msg.data + '\x1b[0m');
          }
          break;
        case 'disconnect':
          conn.terminal.writeln('\r\n\x1b[33m' + (msg.data || 'Disconnected') + '\x1b[0m');
          break;
        case 'dirList':
          renderFileList(connId, msg.path, msg.files || []);
          break;
        case 'cwd':
          if (msg.data) {
            const currentDisplayPath = document.getElementById(`filepath-${connId}`)?.textContent;
            if (msg.data !== currentDisplayPath) {
              newWs.send(JSON.stringify({ type: 'listDir', path: msg.data }));
            }
          }
          break;
      }
    } catch (err) {}
  };

  newWs.onerror = () => {
    try { conn.terminal.writeln('\x1b[31mWebSocket error\x1b[0m'); } catch(e) {}
  };

  newWs.onclose = () => {
    try {
      conn.terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
      conn.terminal.writeln('\x1b[90mPress Enter to reconnect...\x1b[0m');
    } catch(e) {}
    conn._disconnected = true;
  };
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
let _filePages = {}; // 每个连接的当前页码

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
      html += `<div class="term-file-item" data-name="${escapeHtml(f.name)}" data-isdir="false" data-filepath="${itemPath}" data-conn="${connId}">
        <span class="term-file-icon">${icon}</span>
        <span class="term-file-name">${escapeHtml(f.name)}</span>
        <span class="term-file-size">${size}</span>
      </div>`;
    }
  }

  // 分页栏（放到顶部，始终显示两行）
  const pagerEl = document.getElementById(`filepager-${connId}`);
  if (pagerEl) {
    let pagerHtml = `<div class="term-file-stats-line">${fileCount} 个文件，${dirCount} 个文件夹</div>`;
    pagerHtml += `<div class="term-file-pages">`;
    pagerHtml += `<button class="term-page-btn" data-action="file-page" data-conn="${connId}" data-page="${Math.max(1, currentPage - 1)}" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
    for (let i = 1; i <= totalPages; i++) {
      pagerHtml += `<button class="term-page-btn ${i === currentPage ? 'active' : ''}" data-action="file-page" data-conn="${connId}" data-page="${i}">${i}</button>`;
    }
    pagerHtml += `<button class="term-page-btn" data-action="file-page" data-conn="${connId}" data-page="${Math.min(totalPages, currentPage + 1)}" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
    pagerHtml += `</div>`;
    pagerEl.innerHTML = pagerHtml;
  }

  listEl.innerHTML = html;

  // 保存文件数据用于翻页
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

// 上传单个文件（通过 HTTP，不阻塞终端）
function uploadSingleFile(conn, connId, remotePath, file, statusEl) {
  const itemId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const itemHtml = `<div class="term-upload-item" id="${itemId}">
    <div class="upload-item-info">
      <span class="upload-item-name">${escapeHtml(file.name)}</span>
      <span class="upload-item-size">${formatFileSize(file.size)}</span>
    </div>
    <div class="upload-item-bar"><div class="upload-item-progress" id="prog-${itemId}"></div></div>
    <span class="upload-item-percent" id="pct-${itemId}">0%</span>
  </div>`;
  statusEl.insertAdjacentHTML('beforeend', itemHtml);

  const server = _servers.find(s => s.id === conn.serverId);
  if (!server) return;

  const host = server.wsUrl || server.host;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('host', host);
  formData.append('port', String(server.port || 22));
  formData.append('username', server.username);
  formData.append('password', server.password);
  formData.append('path', remotePath);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'http://localhost:18022/upload');

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      const progEl = document.getElementById(`prog-${itemId}`);
      const pctEl = document.getElementById(`pct-${itemId}`);
      if (progEl) progEl.style.width = percent + '%';
      if (pctEl) pctEl.textContent = percent + '%';
    }
  };

  xhr.onload = () => {
    const pctEl = document.getElementById(`pct-${itemId}`);
    const progEl = document.getElementById(`prog-${itemId}`);
    if (xhr.status === 200) {
      if (pctEl) pctEl.textContent = '完成';
      if (progEl) progEl.style.background = '#4caf50';
      // 刷新文件列表
      const curPath = document.getElementById(`filepath-${connId}`)?.textContent || '.';
      conn.ws.send(JSON.stringify({ type: 'listDir', path: curPath }));
    } else {
      if (pctEl) pctEl.textContent = '失败';
      if (progEl) progEl.style.background = '#e57373';
    }
    setTimeout(() => document.getElementById(itemId)?.remove(), 3000);
  };

  xhr.onerror = () => {
    const pctEl = document.getElementById(`pct-${itemId}`);
    const progEl = document.getElementById(`prog-${itemId}`);
    if (pctEl) pctEl.textContent = '失败';
    if (progEl) progEl.style.background = '#e57373';
    setTimeout(() => document.getElementById(itemId)?.remove(), 3000);
  };

  xhr.send(formData);
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
  uploadFile,
  filePageChange,
  downloadFile,
  renameFile,
  addGroup,
  deleteGroup,
  editGroup,
  selectGroup,
  sortServers,
  saveGroup,
  closeGroupModal,
  ctxEditGroup,
  ctxDeleteGroup
};
