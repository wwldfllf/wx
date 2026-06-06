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
IMAGE_API_BASE_URL=https://api.kkk1eran.top
IMAGE_API_KEY=your-api-key
IMAGE_MODEL=gpt-image-2
```

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
IMAGE_API_BASE_URL=https://api.kkk1eran.top
IMAGE_API_KEY=sk-your-server-side-key
IMAGE_MODEL=gpt-image-2
PORT=4173
```
