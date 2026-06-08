# LinkHub Browser Extension

Chrome 浏览器扩展前端，基于 TypeScript + Vite 构建。

## 快速开始

```bash
# 安装依赖
npm install

# 构建
npm run build

# 开发模式（Vite 热更新，仅 newtab 页面）
npm run dev
```

构建产物输出到 `dist/`，在 Chrome `chrome://extensions/` 加载该目录即可。

## 代码结构

```
src/
├── background.ts               # Service Worker
├── content.ts                  # Content Script
├── command.ts                  # 全局命令面板（iframe 版）
├── chrome.d.ts                 # Chrome API 类型声明
├── xterm.d.ts                  # xterm.js 类型声明
│
├── shared/                     # 跨上下文共享模块
│   ├── command-core.ts         #   命令面板 UI 核心（显示/隐藏/过滤/渲染/键盘导航）
│   └── command-items.ts        #   命令列表数据构建（页面/工具/网站/书签/服务器）
│
├── command/
│   └── index.html              # 全局命令面板 HTML（iframe 载体）
│
└── newtab/                     # 新标签页 SPA
    ├── index.html              #   页面模板（含所有弹窗、面板）
    ├── styles.css              #   全局样式（CSS 变量主题，深色/浅色）
    ├── main.ts                 #   入口：路由切换、事件委托、主题管理
    ├── utils.ts                #   工具函数（escapeHtml、debounce、sendMessage 等）
    ├── data.ts                 #   预定义网站分类数据
    ├── sites.ts                #   常用网站模块
    ├── bookmarks.ts            #   书签管理模块（双栏布局、树形结构、拖拽排序）
    ├── todo.ts                 #   待办清单模块（优先级、分组、拖拽排序）
    ├── command.ts              #   页面内命令面板（复用 shared/command-core）
    ├── terminal.ts             #   SSH 终端模块（WebSocket、xterm.js、SFTP）
    ├── tools/                  #   开发者工具（每个工具独立文件）
    │   ├── index.ts            #     入口：Tab 切换、事件绑定
    │   ├── shared.ts           #     共享工具函数（toast、formatDate）
    │   ├── json.ts             #     JSON 格式化/压缩 + 语法高亮
    │   ├── timestamp.ts        #     时间戳 ↔ 日期互转
    │   ├── cron.ts             #     Cron 表达式解析 + 下次执行时间
    │   ├── regex.ts            #     正则表达式测试 + 语法高亮
    │   ├── url.ts              #     URL 编码/解码
    │   ├── base64.ts           #     Base64 编码/解码
    │   ├── jwt.ts              #     JWT Token 解析
    │   ├── hash.ts             #     MD5/SHA 哈希计算
    │   ├── md5.ts              #     MD5 算法纯 TS 实现
    │   └── diff.ts             #     Diff 文本对比（LCS 算法）
    └── public/lib/             #   xterm.js 静态库（构建时复制到 dist）
```

## 模块说明

### background.ts

Chrome Extension Service Worker，职责：
- 代理 Chrome Bookmarks API（newtab 页面通过 sendMessage 调用）
- 监听书签变更事件，广播通知所有标签页
- 获取网站 favicon（fetch HTML 解析 link 标签）
- 批量书签导入（合并/覆盖模式）
- 点击图标 / 浏览器启动时打开 newtab 页面

### content.ts

注入到所有普通网页的 Content Script：
- 监听 Alt+K 快捷键
- 创建 iframe 注入全局命令面板
- 通过 postMessage 接收命令面板指令（打开 URL、跳转 LinkHub 页面）

### shared/ — 共享模块

命令面板在两个上下文中运行（newtab 内 + 普通网页 iframe），共享核心逻辑：
- `command-core.ts`：面板 UI 生命周期（初始化、显示、隐藏、过滤、键盘导航、渲染）
- `command-items.ts`：统一的命令列表构建（接收数据源回调，输出标准化的 CommandItem 数组）

### newtab/ — 新标签页

单页应用，5 个功能页面通过路由切换：

| 模块 | 文件 | 功能 |
|------|------|------|
| 常用网站 | `sites.ts` | 分类卡片展示，favicon 自动加载 |
| 书签 | `bookmarks.ts` | Chrome 书签 CRUD，双栏布局，文件夹树，拖拽排序 |
| 工具 | `tools/*.ts` | 9 个开发者工具，Tab 切换，实时计算 |
| 待办 | `todo.ts` | 左右双栏（待办/已完成），优先级，分组，拖拽 |
| 终端 | `terminal.ts` | SSH 连接管理，xterm.js 终端，SFTP 文件管理，文件编辑器 |

`main.ts` 作为入口，负责：
- 页面路由（hash 导航）
- 全局事件委托（所有 `data-action` 点击统一分发）
- 主题切换（CSS 变量 + localStorage）
- 图片加载失败回退（favicon → 首字）

## 构建流程

`npm run build` 执行 `scripts/build.js`，依次：

1. **TypeScript 类型检查** — `tsc --noEmit`
2. **Vite 构建 newtab** — 打包 `src/newtab/` → `dist/newtab/`（ES Module bundle）
3. **esbuild 编译独立脚本** — 将 `background.ts`、`content.ts`、`command.ts` 编译为 IIFE 格式 JS
4. **复制静态文件** — manifest.json、assets、command/index.html、data.js

### 构建产物

```
dist/
├── manifest.json
├── background.js           ← esbuild 编译
├── content.js              ← esbuild 编译
├── assets/                 ← 直接复制
├── command/
│   ├── index.html          ← 直接复制
│   └── command.js          ← esbuild 编译（bundle，含 shared/ 逻辑）
└── newtab/
    ├── index.html          ← Vite 处理
    ├── styles.css          ← Vite 处理
    ├── js/main.js          ← Vite 打包（所有 newtab 模块的单 bundle）
    ├── js/data.js          ← 构建脚本生成（供 command iframe 引用）
    └── lib/                ← xterm.js 静态库（从 public/ 复制）
```

## 开发说明

- 修改 `src/` 下代码后执行 `npm run build`，然后在 Chrome 扩展页点击 🔄 刷新
- `npm run dev` 可启动 Vite 开发服务器用于 newtab 页面热更新（不含 Chrome API 功能）
- 新增工具：在 `src/newtab/tools/` 下创建文件，在 `tools/index.ts` 中注册
- 新增页面：在 `main.ts` 的路由 switch 和事件委托中添加
