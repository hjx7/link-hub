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
    id: 'search',
    name: '搜索',
    icon: '🔍',
    sites: [
      { name: '百度', url: 'https://www.baidu.com', favicon: 'https://www.baidu.com/favicon.ico' },
      { name: '必应', url: 'https://www.bing.com', favicon: 'https://www.bing.com/favicon.ico' },
      { name: 'Google', url: 'https://www.google.com', favicon: 'https://www.google.com/favicon.ico' },
    ]
  },
  {
    id: 'code',
    name: '代码托管',
    icon: '💻',
    sites: [
      { name: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' },
      { name: 'Gitee', url: 'https://gitee.com', favicon: 'https://gitee.com/favicon.ico' },
      { name: 'GitLab', url: 'https://gitlab.com', favicon: 'https://gitlab.com/favicon.ico' },
    ]
  },
  {
    id: 'docs',
    name: '开发文档',
    icon: '📚',
    sites: [
      { name: 'MDN', url: 'https://developer.mozilla.org', favicon: 'https://developer.mozilla.org/favicon.ico' },
      { name: 'npm', url: 'https://www.npmjs.com', favicon: 'https://www.npmjs.com/favicon.ico' },
      { name: 'Docker Hub', url: 'https://hub.docker.com', favicon: 'https://hub.docker.com/favicon.ico' },
      { name: 'Maven Repository', url: 'https://mvnrepository.com', favicon: 'https://mvnrepository.com/favicon.ico' },
      { name: 'Go Packages', url: 'https://pkg.go.dev', favicon: 'https://pkg.go.dev/favicon.ico' },
      { name: 'PyPI', url: 'https://pypi.org', favicon: 'https://pypi.org/static/images/favicon.35549fe8.ico' },
      { name: 'crates.io', url: 'https://crates.io', favicon: 'https://crates.io/favicon.ico' },
    ]
  },
  {
    id: 'mail',
    name: '邮箱',
    icon: '📧',
    sites: [
      { name: 'QQ邮箱', url: 'https://mail.qq.com', favicon: 'https://mail.qq.com/favicon.ico' },
      { name: '网易邮箱', url: 'https://mail.163.com', favicon: 'https://mail.163.com/favicon.ico' },
      { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
      { name: 'Outlook', url: 'https://outlook.live.com', favicon: 'https://outlook.live.com/favicon.ico' },
    ]
  },
  {
    id: 'translate',
    name: '翻译',
    icon: '🌐',
    sites: [
      { name: '百度翻译', url: 'https://fanyi.baidu.com', favicon: 'https://fanyi.baidu.com/favicon.ico' },
      { name: '有道翻译', url: 'https://fanyi.youdao.com', favicon: 'https://fanyi.youdao.com/favicon.ico' },
      { name: 'DeepL', url: 'https://www.deepl.com/translator', favicon: 'https://www.deepl.com/favicon.ico' },
      { name: 'Google 翻译', url: 'https://translate.google.com', favicon: 'https://translate.google.com/favicon.ico' },
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
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: 'https://stackoverflow.com/favicon.ico' },
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
  },
  {
    id: 'cloud',
    name: '云服务',
    icon: '☁️',
    sites: [
      { name: '阿里云', url: 'https://www.aliyun.com', favicon: 'https://www.aliyun.com/favicon.ico' },
      { name: '腾讯云', url: 'https://cloud.tencent.com', favicon: 'https://cloud.tencent.com/favicon.ico' },
      { name: '华为云', url: 'https://www.huaweicloud.com', favicon: 'https://www.huaweicloud.com/favicon.ico' },
      { name: 'Cloudflare', url: 'https://www.cloudflare.com', favicon: 'https://www.cloudflare.com/favicon.ico' },
    ]
  },
  {
    id: 'tools',
    name: '工具',
    icon: '🔧',
    sites: [
      { name: 'JSON.cn', url: 'https://www.json.cn', favicon: 'https://www.json.cn/favicon.ico' },
      { name: '菜鸟工具', url: 'https://c.runoob.com', favicon: 'https://static.jyshare.com/images/favicon.ico' },
      { name: 'Regex101', url: 'https://regex101.com', favicon: 'https://regex101.com/favicon.ico' },
      { name: 'JWT.io', url: 'https://jwt.io', favicon: 'https://jwt.io/favicon.ico' },
      { name: 'IP 查询', url: 'https://ipinfo.io', favicon: 'https://ipinfo.io/favicon.ico' },
      { name: '时间戳转换', url: 'https://tool.lu/timestamp', favicon: 'https://tool.lu/favicon.ico' },
    ]
  }
];
