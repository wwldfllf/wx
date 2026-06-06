# Image2 Studio

一个用于调用 OpenAI 兼容图片接口的网站。前端负责输入提示词、上传参考图、选择比例和清晰度；后端负责保存 API key、探测模型并转发图片生成请求。

## 本地运行

```bash
npm install
npm start
```

启动后访问：

```text
http://localhost:4173
```

## 后端配置

配置写在 `.env`：

```env
IMAGE_API_BASE_URL=https://api.kkk1eran.top
IMAGE_API_KEY=sk-your-server-side-key
IMAGE_MODEL=gpt-image-2
PORT=4173
```

`IMAGE_API_KEY` 只在后端使用，不会出现在网页源码里。

## 部署成公网网站

把整个 `image2-studio` 目录上传到支持 Node.js 的服务器或平台，然后设置同样的环境变量并运行：

```bash
npm install --omit=dev
npm start
```

域名解析到服务器后，手机或电脑都可以通过网址访问。建议部署时开启 HTTPS。
