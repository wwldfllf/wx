# Image Studio

Image Studio is a Cloudflare Pages image-generation workspace for `gpt-image-2`. It supports text-to-image, reference-image editing, API-detected size options, result preview, and original-image download.

## Architecture

- The browser only calls `/api/capabilities` and `/api/generate-stream`.
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
```

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
