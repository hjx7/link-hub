# LinkHub Chrome Extension

简洁高效的链接书签管理浏览器插件。

## 功能特性

- **📁 书签管理** - 添加、编辑、删除书签，按分类整理
- **🔍 快速搜索** - 即时搜索书签
- **📂 分类管理** - 支持多分类组织书签
- **🛠️ 实用工具** - JSON格式化、时间戳转换、URL编码、Base64
- **⬆️ 导入导出** - 与Chrome原生书签互相导入导出
- **⚡ 轻量快速** - 采用Service Worker，无后台常驻进程

## 安装方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `linkhub-extension` 文件夹

## 使用说明

### 快捷键

- 点击工具栏图标 → 打开书签管理弹窗
- 右下角 ↗️ 按钮 → 在新标签页打开完整界面

### 书签操作

- **添加书签**：点击弹窗右下角 + 按钮，或在当前页面添加
- **导入书签**：从 Chrome 原生书签导入
- **导出书签**：导出到 Chrome 原生书签栏

## 文件结构

```
linkhub-extension/
├── manifest.json       # 插件清单
├── background.js        # 后台服务脚本
├── popup/              # 弹窗界面
│   ├── index.html
│   ├── popup.js
│   └── styles.css
├── newtab/             # 新标签页
│   ├── index.html
│   ├── newtab.js
│   └── styles.css
└── assets/             # 图标资源
```

## 数据存储

使用 Chrome Storage API，数据存储在浏览器本地：
- `linkhub_bookmarks` - 书签数据
- `linkhub_categories` - 分类数据
- `linkhub_quick_links` - 快捷链接
- `linkhub_settings` - 设置

## 开发

如需修改后端同步功能，可修改 `background.js` 中的消息处理逻辑。

## License

MIT
