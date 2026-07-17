# LinkHub

一款功能丰富的 Chrome 浏览器扩展，集成书签管理、常用网站导航、开发者工具箱、待办清单和 SSH 终端于一体。

## 功能模块

### 🌐 常用网站

- 内置常用网站快捷入口，分类展示
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

### 📝 待办清单

- 左右双栏布局（未完成 / 已完成）
- 支持优先级（紧急/普通/不急），色条区分
- 支持分组管理
- 拖拽排序
- 关联链接、备注
- 数据持久化到 localStorage

### 💻 SSH 终端

浏览器内的 SSH 客户端，通过本地 WebSocket 中转服务连接远程服务器。

**服务器管理：**
- 服务器列表，支持分组管理
- 支持搜索、排序（名称/地址）
- 自动检测服务器在线状态和延迟
- 自动获取远程系统信息（OS、CPU、内存、磁盘）
- 支持密码认证和 SSH 密钥认证

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
- 点击文本文件直接打开编辑（支持 50+ 种格式）
- 多 Tab 页，同时编辑多个文件
- 语法高亮（Shell、Python、JavaScript、Go、Java/C、SQL、YAML、JSON、XML、CSS 等）
- 保存到远程服务器（按钮或 Ctrl+S）

### ⌘ 快捷命令面板

- 任意网页按 `Alt+K` 唤起全局命令面板
- 快速搜索书签、跳转页面、打开工具、连接服务器
- 支持模糊搜索，键盘上下选择

## 技术栈

- **前端：** TypeScript + Vite，Chrome Extension Manifest V3
- **终端：** xterm.js + FitAddon
- **后端：** Go，gorilla/websocket，golang.org/x/crypto/ssh，pkg/sftp
- **通信：** WebSocket（浏览器 ↔ 本地中转服务 ↔ 远程 SSH）
- **存储：** Chrome Bookmarks API（书签），localStorage（服务器配置、待办、主题偏好）

## 项目结构

```
linkhub/
├── extension/
│   ├── browser/                    # Chrome 扩展
│   │   ├── src/                    # TypeScript 源码
│   │   │   ├── background.ts      # Service Worker（书签 API、消息处理）
│   │   │   ├── content.ts         # Content Script（Alt+K 唤起命令面板）
│   │   │   ├── command.ts         # 全局命令面板（iframe 内运行）
│   │   │   ├── command/index.html # 全局命令面板 HTML
│   │   │   └── newtab/            # 新标签页 SPA
│   │   │       ├── main.ts        # 入口：路由、事件委托、主题
│   │   │       ├── utils.ts       # 工具函数
│   │   │       ├── data.ts        # 预定义网站数据
│   │   │       ├── sites.ts       # 常用网站模块
│   │   │       ├── bookmarks.ts   # 书签管理模块
│   │   │       ├── todo.ts        # 待办清单模块
│   │   │       ├── command.ts     # 页面内命令面板
│   │   │       ├── terminal.ts    # SSH 终端模块
│   │   │       ├── tools/         # 开发者工具（每个工具独立文件）
│   │   │       ├── styles.css     # 全局样式（CSS 变量主题）
│   │   │       └── index.html     # 页面模板
│   │   ├── dist/                   # 构建产物（不提交版本管理）
│   │   ├── manifest.json           # Chrome 扩展清单
│   │   ├── assets/                 # 图标资源
│   │   ├── package.json            # npm 依赖配置
│   │   ├── tsconfig.json           # TypeScript 配置
│   │   ├── vite.config.ts          # Vite 构建配置
│   │   └── scripts/build.js        # 构建脚本
│   │
│   └── back-end/                   # Go WebSocket-SSH 中转服务
│       ├── main.go                 # 服务端主程序
│       ├── go.mod / go.sum         # Go 依赖
│       ├── installer.iss           # Windows 安装包脚本
│       └── README.md               # 部署文档
│
└── README.md                       # 本文件
```

## 开发

### 前端（Chrome 扩展）

环境要求：Node.js 12.22.0 或更高版本。

```bash
cd extension/browser

# 安装依赖
npm install

# 构建（类型检查 + Vite 打包 + esbuild 编译）
npm run build

# 开发模式（Vite 热更新，仅 newtab 页面）
npm run dev
```

构建产物输出到 `dist/`，在 Chrome 中加载该目录即可。

### 后端（SSH 中转服务）

```bash
cd extension/back-end

# 编译
go build -o linkhub-ssh.exe .
```

**方式一：直接运行**

```bash
./linkhub-ssh.exe -port 18022
```

**方式二：打包为 Windows 安装程序（推荐）**

1. 先编译 `linkhub-ssh.exe`（见上方）
2. 下载安装 [Inno Setup](https://jrsoftware.org/isinfo.php)
3. 用 Inno Setup Compiler 打开 `installer.iss`
4. 点击编译，生成 `LinkHubSSH-Setup.exe`
5. 运行安装包即可完成安装 + 开机自启

安装包会：
- 安装到 `C:\Program Files\LinkHubSSH\`
- 注册开机自启动（注册表 Run 项）
- 安装后立即后台启动服务
- 支持通过控制面板正常卸载

## 安装使用

### 1. 安装 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/browser/dist` 文件夹

### 2. 启动 SSH 中转服务（使用终端功能时需要）

**方式一：直接运行**

```bash
cd extension/back-end
go build -o linkhub-ssh.exe .
./linkhub-ssh.exe
```

**方式二：安装包（推荐，自动开机自启）**

运行 `LinkHubSSH-Setup.exe` 安装即可，无需手动启动。

生成安装包方法见上方「后端」开发说明。

### 3. 使用

- 点击扩展图标或打开新标签页进入 LinkHub
- 左侧导航切换：常用网站 / 书签 / 工具 / 待办 / 终端
- 任意网页按 `Alt+K` 唤起命令面板
- 支持深色/浅色主题切换

## SSH 通信架构

```
浏览器 (xterm.js)
    ↕ WebSocket (ws://localhost:18022/ws)
本地中转服务 (Go)
    ↕ SSH / SFTP
远程服务器
```

中转服务接口：

| 接口 | 方式 | 功能 |
|------|------|------|
| `/ws` | WebSocket | SSH 终端交互、SFTP 文件操作 |
| `/download` | HTTP GET | 文件/文件夹下载 |
| `/upload` | HTTP POST | 分片文件上传 |
| `/ping` | HTTP GET | 服务器端口可达性检测 |
| `/exec` | HTTP POST | 批量执行命令 |
| `/health` | HTTP GET | 服务健康检查 |

## 快捷键

| 快捷键 | 作用域 | 功能 |
|--------|--------|------|
| `Alt+K` | 任意网页 | 唤起命令面板 |
| `Ctrl+S` | 文件编辑器 | 保存文件到远程服务器 |
| `Tab` | 文件编辑器 | 插入 2 空格缩进 |
| `Enter` | 终端（断开状态） | 重新连接 |

## License

MIT
