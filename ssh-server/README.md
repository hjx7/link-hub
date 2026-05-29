# LinkHub SSH Server

本地 WebSocket-SSH 中转服务，配合 LinkHub 浏览器扩展的终端功能使用。

运行在 Windows 本机，浏览器通过 `localhost:18022` 与其通信，由它代理 SSH 连接到远程服务器。

## 功能

- WebSocket 转 SSH，让浏览器直接连接远程服务器终端
- SFTP 文件管理（目录浏览、上传、下载、重命名、读写文件）
- 支持密码和私钥两种认证方式
- 支持多连接、终端大小调整
- 自动获取远程系统信息（OS、CPU、内存、磁盘）
- 服务器端口可达性检测（Ping）
- 心跳保活，自动断开超时连接
- 单文件部署，无依赖

## 安装

已提供打包好的安装程序：

1. 运行 `Output/LinkHubSSH-Setup.exe`
2. 按提示完成安装（默认安装到 `C:\Program Files\LinkHubSSH\`）
3. 安装完成后自动启动服务，并注册开机自启

安装包自动完成：
- 复制 `linkhub-ssh.exe` 到安装目录
- 注册 Windows 开机自启（注册表 `HKCU\...\Run`）
- 安装完成后立即后台启动服务
- 卸载时自动结束进程并清理注册表

### 手动运行

不想用安装包也可以直接运行：

```bash
# 直接启动
linkhub-ssh.exe

# 安装为开机自启
linkhub-ssh.exe -action install

# 卸载开机自启
linkhub-ssh.exe -action uninstall
```

### 验证服务是否运行

浏览器访问 http://localhost:18022/health ，返回以下内容即表示正常：

```json
{"status":"ok","version":"1.0.0"}
```

## 编译

如需自行编译，需要 Go 1.21+：

```bash
go mod tidy
go build -o linkhub-ssh.exe .
```

打包安装程序需要 [Inno Setup](https://jrsoftware.org/isinfo.php)，编译 `installer.iss` 即可生成 `Output/LinkHubSSH-Setup.exe`。

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-action` | `run` | `run` 运行服务，`install` 安装开机自启，`uninstall` 卸载 |
| `-port` | `18022` | 监听端口 |
| `-bind` | `0.0.0.0` | 监听地址 |

## 架构

```
浏览器 (xterm.js)
    ↕ WebSocket (ws://localhost:18022/ws)
本地 linkhub-ssh.exe
    ↕ SSH / SFTP
远程服务器
```

## HTTP 接口

| 路径 | 方法 | 功能 |
|------|------|------|
| `/ws` | WebSocket | SSH 终端交互、SFTP 文件操作 |
| `/download` | GET | 文件/文件夹下载（文件夹自动 tar.gz 打包） |
| `/upload` | POST | 分片文件上传 |
| `/ping` | GET | 检测远程 SSH 端口是否可达，返回延迟 |
| `/health` | GET | 服务健康检查 |

## WebSocket 消息协议

### 客户端 → 服务端

| type | 功能 | 关键字段 |
|------|------|----------|
| `connect` | 建立 SSH 连接 | host, port, username, password/key, cols, rows |
| `input` | 终端输入 | data |
| `resize` | 调整终端大小 | cols, rows |
| `disconnect` | 断开连接 | — |
| `listDir` | 列出目录 | path |
| `getCwd` | 获取当前目录 | — |
| `getSysInfo` | 获取系统信息 | — |
| `readFile` | 读取文件（≤2MB） | path |
| `writeFile` | 写入文件 | path, data |
| `rename` | 重命名 | path（旧路径）, data（新路径） |

### 服务端 → 客户端

| type | 功能 |
|------|------|
| `connected` | SSH 连接成功 |
| `output` | 终端输出 |
| `error` | 错误信息 |
| `disconnect` | SSH 断开 |
| `dirList` | 目录文件列表 |
| `fileContent` | 文件内容 |
| `writeFileOk` | 写入成功 |
| `renameOk` | 重命名成功 |
| `uploadOk` | 上传成功 |
| `cwd` | 当前工作目录 |
| `sysInfo` | 系统信息 |

## 日志

运行日志保存在可执行文件同目录下的 `linkhub-ssh.log`。
