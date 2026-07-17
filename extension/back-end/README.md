# LinkHub SSH Server

Go 实现的 WebSocket-SSH 中转服务，作为浏览器扩展和远程 SSH 服务器之间的桥梁。

## 架构

```
浏览器 (xterm.js)
    ↕ WebSocket (ws://localhost:18022/ws)
本服务 (Go)
    ↕ SSH / SFTP (TCP)
远程 Linux 服务器
```

浏览器无法直接建立 TCP 连接，所以需要本地运行此中转服务，将 WebSocket 消息转发为 SSH 协议。

## 功能实现

### WebSocket 终端交互 (`/ws`)

- 接收浏览器 WebSocket 连接，每个连接对应一个 SSH 会话
- 支持密码认证和 SSH 私钥认证
- 创建 PTY（伪终端），支持 xterm-256color、终端大小调整
- 双向数据流：浏览器输入 → SSH stdin，SSH stdout → 浏览器输出
- 心跳保活（30 秒 Ping），10 分钟无活动超时断开
- 可选 Token 认证（通过 `-token` 参数启用）

**WebSocket 消息类型（客户端 → 服务端）：**

| type | 功能 | 关键字段 |
|------|------|----------|
| `auth` | Token 认证 | `token` |
| `connect` | 建立 SSH 连接 | `sessionId`, `host`, `port`, `username`, `password`/`key`, `cols`, `rows` |
| `input` | 终端输入 | `data` |
| `resize` | 调整终端大小 | `cols`, `rows` |
| `disconnect` | 断开 SSH | — |
| `listDir` | 列出目录 | `path` |
| `getCwd` | 获取当前工作目录 | — |
| `getSysInfo` | 获取远程系统信息 | — |
| `readFile` | 读取文件内容 | `path` |
| `writeFile` | 写入文件内容 | `path`, `data` |
| `rename` | 重命名文件 | `path`(旧), `data`(新) |

**WebSocket 消息类型（服务端 → 客户端）：**

| type | 功能 |
|------|------|
| `auth_ok` | 认证成功 |
| `connected` | SSH 连接建立成功 |
| `output` | 终端输出数据 |
| `error` | 错误信息 |
| `disconnect` | SSH 断开 |
| `dirList` | 目录文件列表 |
| `cwd` | 当前工作目录 |
| `sysInfo` | 系统信息（OS/CPU/内存/磁盘） |
| `fileContent` | 文件内容 |
| `writeFileOk` | 文件写入成功 |
| `renameOk` | 重命名成功 |
| `uploadOk` | 上传成功 |

### SFTP 文件操作

连接建立时自动创建 SFTP 客户端，支持：
- 列出目录内容（文件名、大小、权限、修改时间）
- 路径解析（支持 `..`、相对路径，通过 `RealPath` 获取绝对路径）
- 读取文件（限制 2MB）
- 写入文件（覆盖创建）
- 重命名文件/文件夹
- 分片上传（通过 WebSocket `uploadChunk` 消息）

### HTTP 文件下载 (`/download`)

- 单文件：通过 SFTP 流式读取，返回 `application/octet-stream`
- 文件夹：远程执行 `tar czf -` 实时打包，流式传输 `.tar.gz`
- 复用对应 WebSocket 终端已建立的 SSH 会话
- 终端会话断开后，下载请求会返回会话失效

**参数：** `sessionId`, `path`, `isDir`

### HTTP 分片上传 (`/upload`)

- 支持大文件分片上传（前端切片后逐片 POST）
- 同一文件的多个分片复用同一个 SSH/SFTP 连接（上传会话管理）
- 第一片创建文件，后续分片追加写入
- 最后一片完成后自动关闭会话释放资源
- 超时 5 分钟未活动的上传会话自动清理

**参数：** `host`, `port`, `username`, `password`, `path`, `file`(multipart), `chunk`, `totalChunks`

### 批量命令执行 (`/exec`)

- POST 接收 JSON（host、port、username、password、command）
- 建立独立 SSH 连接，执行命令，返回输出 + 耗时
- 用于对多台服务器批量执行同一命令

**请求体：**
```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "xxx",
  "command": "df -h"
}
```

**响应：**
```json
{
  "success": true,
  "output": "...",
  "elapsed": 156
}
```

### 端口探测 (`/ping`)

- 检测远程主机的 SSH 端口是否可达
- 返回是否在线 + TCP 连接延迟（毫秒）
- 3 秒超时

**参数：** `host`, `port`

### 健康检查 (`/health`)

返回 `{"status": "ok", "version": "1.0.0"}`，用于前端检测中转服务是否运行。

## 启动参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-port` | 18022 | 监听端口 |
| `-bind` | 127.0.0.1 | 绑定地址 |
| `-token` | 空 | 认证 Token（为空则不校验） |
| `-action` | run | 动作：`run`(运行) / `install`(安装自启) / `uninstall`(卸载自启) |

## 部署

### 直接运行

```bash
go build -o linkhub-ssh.exe .
./linkhub-ssh.exe -port 18022
```

### Windows 安装包

1. 编译 `linkhub-ssh.exe`
2. 用 [Inno Setup](https://jrsoftware.org/isinfo.php) 打开 `installer.iss` 编译
3. 生成的 `LinkHubSSH-Setup.exe` 安装后自动：
   - 安装到 `C:\Program Files\LinkHubSSH\`
   - 注册表写入开机自启
   - 后台运行服务
   - 支持控制面板卸载

### Linux

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o linkhub-ssh .
./linkhub-ssh -port 18022

# 或配合 systemd 管理
```

## 日志

运行时日志写入可执行文件同目录的 `linkhub-ssh.log`，记录：
- 连接/断开事件
- SSH 认证结果
- SFTP 操作
- 错误信息

## 代码结构

```
back-end/
├── main.go             # 全部代码（单文件）
├── go.mod / go.sum     # Go 模块依赖
├── installer.iss       # Inno Setup 安装脚本
├── .gitignore          # 忽略 *.exe *.log Output/
└── README.md           # 本文件
```

### main.go 内部结构

| 区域 | 函数 | 职责 |
|------|------|------|
| 数据结构 | `Message`, `FileInfo`, `SSHSession` | WebSocket 消息体、文件信息、SSH 会话封装 |
| WebSocket 核心 | `handleWebSocket()` | 处理 WS 连接生命周期，消息分发（connect/input/resize/listDir/readFile/writeFile 等） |
| SSH 认证 | `handleWebSocket()` 内 `connect` 分支 | 支持密码 + 私钥认证，创建 PTY + Shell |
| 终端输出 | `handleWebSocket()` 内 goroutine | 读取 SSH stdout，过滤 CWD 标记，推送到浏览器 |
| SFTP 操作 | `handleWebSocket()` 内 `listDir`/`readFile`/`writeFile`/`rename`/`upload` 分支 | 文件列表、读写、重命名、分片上传 |
| 系统信息 | `handleWebSocket()` 内 `getSysInfo` 分支 | 远程执行命令获取 OS/CPU/内存/磁盘 |
| HTTP 下载 | `handleDownload()` | 单文件 SFTP 流式下载 / 文件夹 tar.gz 打包下载 |
| HTTP 上传 | `handleUpload()`, `getUploadSession()`, `closeUploadSession()` | 分片上传，会话复用，超时清理 |
| 批量执行 | `handleExec()` | 独立 SSH 连接执行命令，返回输出 |
| 端口探测 | `runServer()` 内 `/ping` handler | TCP 拨号检测 + 延迟测量 |
| 健康检查 | `runServer()` 内 `/health` handler | 返回服务状态 |
| 服务启动 | `main()`, `runServer()` | 参数解析、日志初始化、路由注册、HTTP 监听 |
| Windows 自启 | `installAutoStart()`, `uninstallAutoStart()` | 写入/删除 Startup VBS 脚本 |
| 工具函数 | `indexOf()`, `splitPath()`, `base64Decode()` | 字符串查找、路径分割、Base64 解码 |

## 依赖

- [gorilla/websocket](https://github.com/gorilla/websocket) — WebSocket 服务
- [golang.org/x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh) — SSH 客户端
- [pkg/sftp](https://github.com/pkg/sftp) — SFTP 客户端
