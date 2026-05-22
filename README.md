# LinkHub - 书签管理器

简洁高效的 Chrome 浏览器书签管理插件。

## 功能

- **常用网站** — 内置常用网站快捷入口，分类展示
- **书签管理** — 可视化管理 Chrome 原生书签，支持文件夹树、拖拽排序、导入导出
- **实用工具** — JSON 格式化、时间戳转换、URL 编解码、Base64、颜色转换、UUID 生成
- **快捷命令面板** — 任意网页 `Ctrl+K` 唤起，快速搜索书签、跳转页面、打开工具
- **启动自动打开** — 浏览器启动时自动打开 LinkHub 页面

## 安装

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `linkhub-extension` 文件夹

## 使用

- 点击工具栏 LinkHub 图标 → 打开管理页面
- 任意网页按 `Ctrl+K` → 唤起命令面板，搜索书签或执行操作
- 浏览器启动时自动打开 LinkHub 页面

## 项目结构

```
linkhub-extension/
├── manifest.json          # 插件清单
├── background.js          # Service Worker（书签 API、消息处理）
├── content.js             # Content Script（全局 Ctrl+K 监听）
├── command/               # 全局命令面板（iframe 嵌入）
│   ├── index.html
│   └── command.js
├── newtab/                # 主界面
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── utils.js       # 工具函数
│       ├── data.js        # 内置网站数据
│       ├── sites.js       # 常用网站模块
│       ├── bookmarks.js   # 书签管理模块
│       ├── tools.js       # 实用工具模块
│       ├── command.js     # 页面内命令面板
│       └── main.js        # 入口、路由、事件
└── assets/                # 图标资源
    ├── icon.svg
    └── icon16.svg
```

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript（无框架依赖）
- Chrome Bookmarks API / Storage API
- Service Worker + Content Script + iframe 通信

## 数据存储

使用 Chrome 原生书签系统，数据与浏览器书签完全同步，无需额外存储。

## License

MIT
