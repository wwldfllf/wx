# Image2 Studio

Image2 Studio 是一个可以部署到 Cloudflare Pages 的图片生成网站。前端在 `public/`，后端 API 使用 Cloudflare Pages Functions，路径仍然是 `/api/capabilities`、`/api/generate` 和 `/api/health`。

## Cloudflare Pages 部署

在 Cloudflare Pages 里连接这个 GitHub 仓库后，使用下面的设置：

```text
Framework preset: None
Build command: exit 0
Build output directory: public
Root directory: /
```

如果 Cloudflare 界面允许 Build command 留空，也可以留空；这个项目没有前端构建步骤。

然后在 Pages 项目的环境变量里添加：

```env
IMAGE_API_BASE_URL=https://api.kkk1eran.top
IMAGE_API_KEY=你的 API key
IMAGE_MODEL=gpt-image-2
```

`IMAGE_API_KEY` 必须放在 Cloudflare 的环境变量里，不要写进前端代码，也不要提交到 GitHub。

## 本地 Node 调试

本地也可以用 Express 版本调试：

```bash
npm install
npm start
```

启动后访问：

```text
http://localhost:4173
```

本地 `.env` 示例：

```env
IMAGE_API_BASE_URL=https://api.kkk1eran.top
IMAGE_API_KEY=sk-your-server-side-key
IMAGE_MODEL=gpt-image-2
PORT=4173
```

## 功能

- 自动探测可用图片模型。
- 支持 `gpt-image-2` 文生图。
- 支持上传参考图后图加文生图。
- 支持比例、清晰度、输出格式选择。
- 生成结果直接显示在网页中，并可下载保存。
