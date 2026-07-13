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

The production UI uses browser-direct mode:

- Generation requests go from the browser directly to `https://api.codeyu.shop`.
- The user enters an API key in the page. It is never committed to GitHub or returned by Cloudflare.
- "Remember on this device" stores the key only in that browser's local storage.
- Text-to-image and image editing use the gateway's documented `gpt-image-2` request shapes.
- The browser aborts requests after 300000 ms.

This removes Cloudflare Pages Functions from the long-running generation path. Cloudflare's approximately 120-second proxy read timeout can no longer produce HTTP 524 for image generation.

## Important

Do not commit your real API key to GitHub. Enter it in the website when generating an image. Leave "Remember on this device" unchecked on shared devices.

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

The deployed Cloudflare site cannot run Python directly. The browser and this local Python script use the same request format.

You can test the gateway locally with:

```bash
python scripts/image2_gateway.py --prompt "a simple green icon on a white background" --size 1024x1024
```

For image editing:

```bash
python scripts/image2_gateway.py --prompt "turn this into a watercolor poster" --size 1024x1024 --image path/to/input.png
```
