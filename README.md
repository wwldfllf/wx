# Image Studio

Image Studio is a Cloudflare Pages image and video generation workspace. It supports `gpt-image-2` text-to-image and reference-image editing, plus asynchronous Doubao Seedance 2.0 Mini text-to-video and first-frame-to-video tasks.

The first screen is an interactive Three.js welcome scene. Selecting "开始创作" transitions into the image workspace without a page reload, and the workspace brand returns to the welcome scene.

## Architecture

- The browser only calls same-origin `/api/` routes. Image generation uses `/api/generate-stream`; video generation creates an Ark task and polls `/api/video/tasks/:id`.
- Three.js and Lucide are vendored under `public/vendor/`, so the interface has no runtime CDN dependency.
- The upstream API key stays in Cloudflare Pages Secrets and is never sent to the browser.
- The generation function sends an NDJSON heartbeat every 8 seconds so the browser receives visible progress.
- Requests to `api.codeyu.shop` use Cloudflare's outbound TLS socket transport instead of the normal Worker `fetch()` path.
- The upstream timeout is 10 minutes. The browser allows another 30 seconds for the final response to arrive.

## Cloudflare Pages

Use these build settings:

```text
Framework preset: None
Build command: exit 0
Build output directory: public
Root directory: /
```

Configure these encrypted Pages Secrets:

```text
IMAGE_API_BASE_URL=https://api.codeyu.shop
IMAGE_API_KEY=your-server-side-key
IMAGE_UPSTREAM_TIMEOUT_MS=600000
ARK_API_KEY=your-volcengine-ark-key
ARK_VIDEO_MODEL=doubao-seedance-2-0-mini
```

`ARK_BASE_URL` is optional and defaults to `https://ark.cn-beijing.volces.com/api/v3`.

`IMAGE_API_TRANSPORT=socket` is optional. The function selects socket transport automatically for `api.codeyu.shop`; set it explicitly only when overriding that behavior.

Do not put a real key in `public/`, GitHub Actions variables exposed to builds, or any client-side JavaScript.

## Local Development

Install dependencies and start the Express development server:

```bash
npm install
npm start
```

Then open `http://localhost:4173`.

Create a local `.env` file based on `.env.example`:

```env
IMAGE_API_BASE_URL=https://api.codeyu.shop
IMAGE_API_KEY=sk-your-server-side-key
IMAGE_MODEL=gpt-image-2
IMAGE_UPSTREAM_TIMEOUT_MS=600000
ARK_API_KEY=ark-your-server-side-key
ARK_VIDEO_MODEL=doubao-seedance-2-0-mini
PORT=4173
```

Run the local smoke test while the server is running:

```bash
npm run smoke
```

## Python Gateway Test

The Python script uses the same documented request shape and defaults to a 10-minute timeout:

```bash
python scripts/image2_gateway.py --prompt "a simple green icon on a white background" --size 1024x1024
```

For reference-image editing:

```bash
python scripts/image2_gateway.py --prompt "turn this into a watercolor poster" --size 1024x1024 --image path/to/input.png
```
