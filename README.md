# 记账本（本地优先个人开支记录）

一个「打开就记」的本地优先记账单页应用。纯 HTML + CSS + JavaScript，无框架、无构建工具、无后端，数据存浏览器 `localStorage`。

## 本地运行

直接用浏览器打开 `index.html` 即可使用。想体验 PWA（离线/安装），可用任意静态服务器起本地服务，例如：

```bash
# 任选其一
npx serve .
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 部署到手机使用（3 步）

1. 把整个文件夹推到 GitHub，或导入 Vercel 项目（框架选 Other，无构建命令）。
2. GitHub Pages：Settings → Pages 选 main 分支根目录；Vercel：直接 Deploy。
3. 手机浏览器打开部署后的 HTTPS 链接 → 浏览器菜单「添加到主屏幕」→ 图标即可离线打开。

## 数据说明

- 存储键：`expenses`，结构 `{ "version": 1, "expenses": [...] }`。
- 每条支出：`id` / `amount`(数字) / `category` / `date`(YYYY-MM-DD) / `note` / `createdAt`(ISO)。
- 点「导出数据」下载 `expenses-backup-YYYY-MM-DD.json`；点「导入数据」选择该文件即可把记录合并回来（按 `id` 去重，已有的跳过、新的追加）。

## 更新后刷新缓存

PWA 会用 Service Worker 缓存静态文件。部署新版本后，若页面看起来还是旧的，手动刷新一次即可触发缓存更新（缓存版本号每次发布递增，旧缓存会自动清理）。
