# LinkHub

一款功能丰富的 Chrome 浏览器扩展，集成书签管理、常用网站导航、开发者工具箱和 SSH 终端于一体。

## 功能模块

### 🌐 常用网站

- 内置常用网站快捷入口，分类展示
- 支持自定义添加、编辑、删除
- 自动获取网站 Favicon 图标

### 📁 书签管理

- 可视化管理 Chrome 原生书签，数据与浏览器完全同步
- 左侧文件夹树 + 右侧内容面板的双栏布局
- 支持文件夹拖拽排序、右键菜单操作
- 支持书签搜索、导入导出（JSON 格式）
- 支持合并导入或覆盖导入

### 🛠️ 实用工具

Tab 式多工具面板，包含：

| 工具 | 功能 |
|------|------|
| JSON | 格式化 / 压缩，语法高亮，实时解析 |
| 时间戳 | 时间戳 ↔ 日期时间互转，支持秒/毫秒，支持时区 |
| Cron | Cron 表达式解析，显示下次执行时间，常用表达式参考 |
| 正则 | 正则表达式实时匹配测试，语法高亮，匹配结果展示 |
| URL | URL 编码 / 解码 |
| Base64 | Base64 编码 / 解码 |
| JWT | JWT Token 解析，Header / Payload / Signature 分段展示 |
| 哈希 | MD5 / SHA-1 / SHA-256 / SHA-512 哈希计算 |
| Diff | 文本对比，逐行高亮差异 |

### 💻 SSH 终端

浏览器内的 SSH 客户端，通过本地 WebSocket 中转服务连接远程服务器。

**服务器管理：**
- 服务器列表，支持分组管理
- 支持搜索、排序（名称/地址）
- 自动检测服务器在线状态和延迟
- 自动获取远程系统信息（OS、CPU、内存、磁盘）
- 支持密码认证，未保存密码时终端内输入

**终端功能：**
- 基于 xterm.js 的完整终端模拟器，支持 256 色
- 多 Tab 页，同时连接多台服务器
- 终端大小自适应，支持窗口缩放
- 断线自动重连（3 秒后自动重试，最多 3 次），也支持手动回车重连

**文件管理（SFTP）：**
- 左侧文件列表面板，显示远程目录内容
- 支持目录导航、分页浏览
- 文件/文件夹上传（分片上传，显示进度和速率）
- 文件/文件夹下载（文件夹自动打包为 tar.gz）
- 文件重命名（右键菜单）
- 拖拽上传
- 文件面板可隐藏/展开

**文件编辑器：**
- 点击文本文件直接打开编辑（支持 .sh .py .js .go .json .yaml .conf .log .sql 等 50+ 种格式）
- 多 Tab 页，同时编辑多个文件
- 语法高亮（Shell、Python、JavaScript、Go、Java/C、SQL、YAML、JSON、XML、CSS、INI 等）
- 行号显示
- 保存到远程服务器（按钮或 Ctrl+S）
- 刷新获取最新文件内容
- 修改标记（未保存文件 Tab 显示 ● 标记）
- 上下分割布局，可拖拽调整编辑器和终端的比例

### ⌘ 快捷命令面板

- 任意网页按 `Ctrl+K` 唤起全局命令面板
- 快速搜索书签、跳转页面、打开工具
- 支持模糊搜索，键盘上下选择

## 安装

### Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `linkhub-extension` 文件夹

### SSH 中转服务

终端功能需要本地运行 WebSocket-SSH 中转服务：

```bash
# Windows - 安装为开机自启
cd ssh-server
go build -o linkhub-ssh.exe .
linkhub-ssh.exe -action install

# 或直接运行
linkhub-ssh.exe -port 18022
```

```bash
# Linux - 编译部署
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o linkhub-ssh .
./linkhub-ssh -port 18022
```

详细部署说明见 [ssh-server/README.md](ssh-server/README.md)

## 使用

- 新标签页自动打开 LinkHub 主界面
- 左侧导航切换：常用网站 / 书签 / 工具 / 终端
- 任意网页按 `Ctrl+K` 唤起命令面板
- 支持深色/浅色主题切换

## 项目结构

```
linkhub-extension/
├── manifest.json            # Chrome 扩展清单 (Manifest V3)
├── background.js            # Service Worker（书签 API、消息处理、自动打开）
├── content.js               # Content Script（全局 Ctrl+K 监听）
├── command/                 # 全局命令面板（iframe 注入）
│   ├── index.html
│   └── command.js
├── newtab/                  # 主界面（新标签页）
│   ├── index.html           # SPA 入口
│   ├── styles.css           # 全局样式（含深色模式）
│   ├── js/
│   │   ├── utils.js         # 工具函数（防抖、格式化等）
│   │   ├── data.js          # 内置网站数据
│   │   ├── sites.js         # 常用网站模块
│   │   ├── bookmarks.js     # 书签管理模块
│   │   ├── tools.js         # 开发者工具模块
│   │   ├── terminal.js      # SSH 终端模块（连接、文件、编辑器）
│   │   ├── command.js       # 页面内命令面板
│   │   └── main.js          # 入口、路由、事件委托
│   └── lib/                 # 第三方库
│       ├── xterm.min.js     # xterm.js 终端模拟器
│       ├── xterm.min.css
│       └── xterm-addon-fit.min.js
├── ssh-server/              # WebSocket-SSH 中转服务（Go）
│   ├── main.go              # 服务端主程序
│   ├── go.mod
│   ├── go.sum
│   ├── installer.iss        # Windows 安装包脚本
│   └── README.md            # 服务端部署文档
└── assets/                  # 图标资源
    ├── icon.svg
    └── icon16.svg
```

## 技术栈

- **前端：** Chrome Extension Manifest V3，原生 JavaScript（无框架），CSS 变量主题系统
- **终端：** xterm.js + FitAddon
- **后端：** Go，gorilla/websocket，golang.org/x/crypto/ssh，pkg/sftp
- **通信：** WebSocket（浏览器 ↔ 本地中转服务 ↔ 远程 SSH）
- **存储：** Chrome Bookmarks API（书签），localStorage（服务器配置、主题偏好）

## SSH 通信架构

```
浏览器 (xterm.js)
    ↕ WebSocket (ws://localhost:18022/ws)
本地中转服务 (Go)
    ↕ SSH / SFTP
远程服务器
```

中转服务提供的接口：

| 接口 | 方式 | 功能 |
|------|------|------|
| `/ws` | WebSocket | SSH 终端交互、SFTP 文件操作 |
| `/download` | HTTP GET | 文件/文件夹下载 |
| `/upload` | HTTP POST | 分片文件上传 |
| `/ping` | HTTP GET | 服务器端口可达性检测 |
| `/health` | HTTP GET | 服务健康检查 |

## WebSocket 消息类型

### 客户端 → 服务端

| type | 功能 |
|------|------|
| `connect` | 建立 SSH 连接 |
| `input` | 发送终端输入 |
| `resize` | 调整终端大小 |
| `disconnect` | 断开连接 |
| `listDir` | 列出目录内容 |
| `getCwd` | 获取当前工作目录 |
| `getSysInfo` | 获取系统信息 |
| `readFile` | 读取文件内容 |
| `writeFile` | 写入文件内容 |
| `rename` | 重命名文件/文件夹 |

### 服务端 → 客户端

| type | 功能 |
|------|------|
| `connected` | 连接成功 |
| `output` | 终端输出 |
| `error` | 错误信息 |
| `disconnect` | SSH 断开 |
| `dirList` | 目录列表 |
| `cwd` | 当前工作目录 |
| `sysInfo` | 系统信息 |
| `fileContent` | 文件内容 |
| `writeFileOk` | 文件写入成功 |
| `renameOk` | 重命名成功 |
| `uploadOk` | 上传成功 |

## 快捷键

| 快捷键 | 作用域 | 功能 |
|--------|--------|------|
| `Ctrl+K` | 任意网页 | 唤起命令面板 |
| `Ctrl+S` | 文件编辑器 | 保存文件到远程服务器 |
| `Tab` | 文件编辑器 | 插入 2 空格缩进 |
| `Enter` | 终端（断开状态） | 重新连接 |

## License

MIT
