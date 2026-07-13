# Image2 Studio

Image2 Studio is a Cloudflare Pages site for generating images through an OpenAI-compatible image API.

## Cloudflare Pages Settings

Use these build settings:

```text
Framework preset: None
Build command: exit 0
Build output directory: public
Root directory: /
```

Add these variables in Cloudflare Pages:

```text
Settings -> Environment variables -> Production
```

Required variables:

```env
IMAGE_API_BASE_URL=https://api.codeyu.shop
IMAGE_API_KEY=your-api-key
```

`IMAGE_API_BASE_URL` can be either `https://api.codeyu.shop` or `https://api.codeyu.shop/v1`; the app normalizes both to the correct image endpoint. Use this direct API subdomain to avoid Cloudflare 524 timeouts on the proxied root domain.

Generation is pinned to `gpt-image-2` to match the Python examples in the gateway docs. `IMAGE_MODEL` is ignored by the Cloudflare backend.

When the base URL is `api.codeyu.shop`, Pages Functions automatically use a direct TCP+TLS transport instead of Worker `fetch()`. This keeps the API key server-side while avoiding the approximately 120-second proxy read timeout that causes HTTP 524 during slow image generations.

Optional variable for slow image generations:

```env
IMAGE_UPSTREAM_TIMEOUT_MS=300000
```

The value is in milliseconds. The default is 300000, which is 5 minutes. The app treats smaller values as 300000 and accepts larger values up to 900000.

After adding or editing variables, redeploy the latest Production deployment. Cloudflare does not inject newly-added variables into an already-built deployment.

## Important

Do not commit your real API key to GitHub. Put it only in Cloudflare Pages environment variables.

## Local Node Debug

The project still includes a local Express server for development:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:4173
```

Local `.env` example:

```env
IMAGE_API_BASE_URL=https://api.codeyu.shop
IMAGE_API_KEY=sk-your-server-side-key
IMAGE_MODEL=gpt-image-2
PORT=4173
```

## Local Python Gateway Test

The deployed Cloudflare site cannot run Python directly, so the Pages Function mirrors the same request format as the Python example in the gateway docs.

You can test the gateway locally with:

```bash
python scripts/image2_gateway.py --prompt "a simple green icon on a white background" --size 1024x1024
```

For image editing:

```bash
python scripts/image2_gateway.py --prompt "turn this into a watercolor poster" --size 1024x1024 --image path/to/input.png
```
