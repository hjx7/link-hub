/**
 * LinkHub - 预定义数据模块
 */

export interface SiteItem {
  name: string;
  url: string;
  favicon?: string;
}

export interface SiteCategory {
  id: string;
  name: string;
  icon: string;
  sites: SiteItem[];
}

export const devSiteCategories: SiteCategory[] = [
  {
    id: 'code',
    name: '代码托管',
    icon: '💻',
    sites: [
      { name: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' },
      { name: 'Gitee', url: 'https://gitee.com', favicon: 'https://gitee.com/favicon.ico' },
    ]
  },
  {
    id: 'mail',
    name: '邮箱',
    icon: '📧',
    sites: [
      { name: 'QQ邮箱', url: 'https://mail.qq.com', favicon: 'https://mail.qq.com/favicon.ico' },
      { name: '网易邮箱', url: 'https://mail.163.com', favicon: 'https://mail.163.com/favicon.ico' },
    ]
  },
  {
    id: 'tools',
    name: '工具',
    icon: '🔧',
    sites: [
      { name: '百度翻译', url: 'https://fanyi.baidu.com', favicon: 'https://fanyi.baidu.com/favicon.ico' },
    ]
  },
  {
    id: 'community',
    name: '社区',
    icon: '💬',
    sites: [
      { name: '知乎', url: 'https://zhihu.com', favicon: 'https://zhihu.com/favicon.ico' },
      { name: 'B 站', url: 'https://bilibili.com', favicon: 'https://bilibili.com/favicon.ico' },
      { name: 'CSDN', url: 'https://csdn.net', favicon: 'https://csdn.net/favicon.ico' },
      { name: '稀土掘金', url: 'https://juejin.cn', favicon: 'https://juejin.cn/favicon.ico' },
      { name: '博客园', url: 'https://www.cnblogs.com', favicon: 'https://www.cnblogs.com/favicon.ico' },
    ]
  },
  {
    id: 'ai',
    name: 'AI',
    icon: '🤖',
    sites: [
      { name: 'DeepSeek', url: 'https://chat.deepseek.com', favicon: 'https://chat.deepseek.com/favicon.ico' },
      { name: 'Kimi', url: 'https://kimi.moonshot.cn', favicon: 'https://kimi.moonshot.cn/favicon.ico' },
      { name: '通义千问', url: 'https://www.qianwen.com', favicon: 'https://www.qianwen.com/favicon.ico' },
      { name: '文心一言', url: 'https://yiyan.baidu.com', favicon: 'https://yiyan.baidu.com/favicon.ico' },
      { name: '豆包', url: 'https://www.doubao.com', favicon: 'https://www.doubao.com/favicon.ico' },
      { name: '元宝', url: 'https://yuanbao.tencent.com', favicon: 'https://yuanbao.tencent.com/favicon.ico' },
    ]
  }
];
