/**
 * LinkHub New Tab - 预定义数据模块
 */

// 程序员常用网站分类数据
const devSiteCategories = [
  {
    id: 'frontend',
    name: '前端开发',
    icon: '🎨',
    sites: [
      { name: 'Vue.js', url: 'https://vuejs.org', favicon: 'https://vuejs.org/logo.svg' },
      { name: 'React', url: 'https://react.dev', favicon: 'https://react.dev/favicon.ico' },
      { name: 'Angular', url: 'https://angular.io', favicon: 'https://angular.io/assets/images/favicons/favicon.ico' },
      { name: 'Tailwind CSS', url: 'https://tailwindcss.com', favicon: 'https://tailwindcss.com/favicons/apple-touch-icon.png' },
      { name: 'Element Plus', url: 'https://element-plus.org', favicon: 'https://element-plus.org/favicon.ico' },
      { name: 'Ant Design', url: 'https://ant.design', favicon: 'https://ant.design/favicon.ico' },
      { name: 'Bootstrap', url: 'https://getbootstrap.com', favicon: 'https://getbootstrap.com/docs/5.3/assets/img/favicons/favicon.ico' },
      { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', favicon: 'https://developer.mozilla.org/favicon.ico' },
      { name: 'Can I Use', url: 'https://caniuse.com', favicon: 'https://caniuse.com/img/favicons/apple-touch-icon.png' },
      { name: 'TypeScript', url: 'https://www.typescriptlang.org', favicon: 'https://www.typescriptlang.org/favicon.ico' },
    ]
  },
  {
    id: 'backend',
    name: '后端开发',
    icon: '⚙️',
    sites: [
      { name: 'Node.js', url: 'https://nodejs.org', favicon: 'https://nodejs.org/favicon.ico' },
      { name: 'Python', url: 'https://python.org', favicon: 'https://python.org/favicon.ico' },
      { name: 'Spring', url: 'https://spring.io', favicon: 'https://spring.io/favicon.ico' },
      { name: 'Go', url: 'https://go.dev', favicon: 'https://go.dev/favicon.ico' },
      { name: 'Rust', url: 'https://rust-lang.org', favicon: 'https://www.rust-lang.org/favicon.ico' },
      { name: '.NET', url: 'https://dotnet.microsoft.com', favicon: 'https://dotnet.microsoft.com/favicon.ico' },
      { name: 'Express', url: 'https://expressjs.com', favicon: 'https://expressjs.com/favicon.ico' },
      { name: 'FastAPI', url: 'https://fastapi.tiangolo.com', favicon: 'https://fastapi.tiangolo.com/img/favicon.ico' },
      { name: 'Django', url: 'https://www.djangoproject.com', favicon: 'https://www.djangoproject.com/favicon.ico' },
      { name: 'Flask', url: 'https://flask.palletsprojects.com', favicon: 'https://flask.palletsprojects.com/favicon.ico' },
    ]
  },
  {
    id: 'devops',
    name: 'DevOps & 云服务',
    icon: '☁️',
    sites: [
      { name: 'Docker', url: 'https://docker.com', favicon: 'https://www.docker.com/favicon.ico' },
      { name: 'Kubernetes', url: 'https://kubernetes.io', favicon: 'https://kubernetes.io/favicon.ico' },
      { name: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' },
      { name: 'GitLab', url: 'https://gitlab.com', favicon: 'https://gitlab.com/favicon.ico' },
      { name: 'Gitee', url: 'https://gitee.com', favicon: 'https://gitee.com/favicon.ico' },
      { name: 'AWS', url: 'https://aws.amazon.com', favicon: 'https://aws.amazon.com/favicon.ico' },
      { name: '阿里云', url: 'https://aliyun.com', favicon: 'https://www.aliyun.com/favicon.ico' },
      { name: 'Vercel', url: 'https://vercel.com', favicon: 'https://vercel.com/favicon.ico' },
      { name: 'Netlify', url: 'https://netlify.com', favicon: 'https://www.netlify.com/favicon.ico' },
      { name: 'Nginx', url: 'https://nginx.org', favicon: 'https://nginx.org/favicon.ico' },
    ]
  },
  {
    id: 'tools',
    name: '开发工具',
    icon: '🔧',
    sites: [
      { name: 'VS Code', url: 'https://code.visualstudio.com', favicon: 'https://code.visualstudio.com/favicon.ico' },
      { name: 'JetBrains', url: 'https://jetbrains.com', favicon: 'https://www.jetbrains.com/favicon.ico' },
      { name: 'Postman', url: 'https://postman.com', favicon: 'https://www.postman.com/favicon.ico' },
      { name: 'Insomnia', url: 'https://insomnia.rest', favicon: 'https://insomnia.rest/favicon.ico' },
      { name: 'TablePlus', url: 'https://tableplus.com', favicon: 'https://tableplus.com/favicon.ico' },
      { name: 'DBeaver', url: 'https://dbeaver.io', favicon: 'https://dbeaver.io/favicon.ico' },
      { name: 'Figma', url: 'https://figma.com', favicon: 'https://figma.com/favicon.ico' },
      { name: 'Notion', url: 'https://notion.so', favicon: 'https://www.notion.so/images/favicon.ico' },
      { name: 'Obsidian', url: 'https://obsidian.md', favicon: 'https://obsidian.md/favicon.ico' },
      { name: 'GitHub Copilot', url: 'https://github.com/features/copilot', favicon: 'https://github.com/favicon.ico' },
    ]
  },
  {
    id: 'community',
    name: '社区 & 问答',
    icon: '💬',
    sites: [
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: 'https://stackoverflow.com/favicon.ico' },
      { name: 'SegmentFault', url: 'https://segmentfault.com', favicon: 'https://segmentfault.com/favicon.ico' },
      { name: '掘金', url: 'https://juejin.cn', favicon: 'https://juejin.cn/favicon.ico' },
      { name: 'CSDN', url: 'https://csdn.net', favicon: 'https://csdn.net/favicon.ico' },
      { name: '知乎', url: 'https://zhihu.com', favicon: 'https://zhihu.com/favicon.ico' },
      { name: 'V2EX', url: 'https://v2ex.com', favicon: 'https://v2ex.com/favicon.ico' },
      { name: 'Reddit', url: 'https://reddit.com/r/programming', favicon: 'https://reddit.com/favicon.ico' },
      { name: 'Dev.to', url: 'https://dev.to', favicon: 'https://dev.to/favicon.ico' },
      { name: 'Hashnode', url: 'https://hashnode.com', favicon: 'https://hashnode.com/favicon.ico' },
      { name: 'Medium', url: 'https://medium.com', favicon: 'https://medium.com/favicon.ico' },
    ]
  },
  {
    id: 'learning',
    name: '学习资源',
    icon: '📚',
    sites: [
      { name: 'freeCodeCamp', url: 'https://freecodecamp.org', favicon: 'https://freecodecamp.org/favicon.ico' },
      { name: 'LeetCode', url: 'https://leetcode.com', favicon: 'https://leetcode.com/favicon.ico' },
      { name: '力扣', url: 'https://leetcode.cn', favicon: 'https://leetcode.cn/favicon.ico' },
      { name: '牛客网', url: 'https://nowcoder.com', favicon: 'https://nowcoder.com/favicon.ico' },
      { name: 'HackerRank', url: 'https://hackerrank.com', favicon: 'https://hackerrank.com/favicon.ico' },
      { name: 'Codecademy', url: 'https://codecademy.com', favavicon: 'https://codecademy.com/favicon.ico' },
      { name: 'Coursera', url: 'https://coursera.org', favicon: 'https://coursera.org/favicon.ico' },
      { name: '慕课网', url: 'https://imooc.com', favicon: 'https://imooc.com/favicon.ico' },
      { name: 'B 站', url: 'https://bilibili.com', favicon: 'https://bilibili.com/favicon.ico' },
      { name: 'YouTube', url: 'https://youtube.com', favicon: 'https://youtube.com/favicon.ico' },
    ]
  },
  {
    id: 'ai',
    name: 'AI & ML',
    icon: '🤖',
    sites: [
      { name: 'ChatGPT', url: 'https://chat.openai.com', favicon: 'https://chat.openai.com/favicon.ico' },
      { name: 'Claude', url: 'https://claude.ai', favicon: 'https://claude.ai/favicon.ico' },
      { name: 'Gemini', url: 'https://gemini.google.com', favicon: 'https://gemini.google.com/favicon.ico' },
      { name: 'Perplexity', url: 'https://perplexity.ai', favicon: 'https://perplexity.ai/favicon.ico' },
      { name: 'DeepSeek', url: 'https://deepseek.com', favicon: 'https://deepseek.com/favicon.ico' },
      { name: 'Kimi', url: 'https://kimi.moonshot.cn', favicon: 'https://kimi.moonshot.cn/favicon.ico' },
      { name: '通义千问', url: 'https://tongyi.aliyun.com', favicon: 'https://tongyi.aliyun.com/favicon.ico' },
      { name: '文心一言', url: 'https://yiyan.baidu.com', favicon: 'https://yiyan.baidu.com/favicon.ico' },
      { name: 'Hugging Face', url: 'https://huggingface.co', favicon: 'https://huggingface.co/favicon.ico' },
      { name: 'TensorFlow', url: 'https://tensorflow.org', favicon: 'https://tensorflow.org/favicon.ico' },
    ]
  },
  {
    id: 'reference',
    name: '技术参考',
    icon: '📖',
    sites: [
      { name: 'Git 文档', url: 'https://git-scm.com/doc', favicon: 'https://git-scm.com/favicon.ico' },
      { name: 'npm', url: 'https://npmjs.com', favicon: 'https://npmjs.com/favicon.ico' },
      { name: 'Yarn', url: 'https://yarnpkg.com', favicon: 'https://yarnpkg.com/favicon.ico' },
      { name: 'pnpm', url: 'https://pnpm.io', favicon: 'https://pnpm.io/favicon.ico' },
      { name: 'Maven', url: 'https://maven.apache.org', favicon: 'https://maven.apache.org/favicon.ico' },
      { name: 'Gradle', url: 'https://gradle.org', favicon: 'https://gradle.org/favicon.ico' },
      { name: 'Redis', url: 'https://redis.io', favicon: 'https://redis.io/favicon.ico' },
      { name: 'MongoDB', url: 'https://mongodb.com', favicon: 'https://mongodb.com/favicon.ico' },
      { name: 'PostgreSQL', url: 'https://postgresql.org', favicon: 'https://postgresql.org/favicon.ico' },
      { name: 'MySQL', url: 'https://mysql.com', favicon: 'https://mysql.com/favicon.ico' },
    ]
  }
];

// 暴露到全局
window.LinkHubData = {
  devSiteCategories
};
