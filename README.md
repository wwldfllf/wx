# 灵感画室 · Image Studio

Cloudflare Pages image workspace with text-to-image and reference-image editing. Video is not public: both runtimes return `404` for video routes without creating upstream tasks. The video implementation remains in the repository for a future release.

## Image settings

- `gpt-image-2.6`: eleven ratio presets plus custom dimensions. This site's initial bounds are 512–2048 px per side, multiples of 16, at least 655,360 total pixels, and up to 2:1 between the long and short edges. These are app bounds, not a statement of the provider's full range.
- The website passes through `auto`, `low`, `medium` and `high` quality on 2.6; the server does not claim the gateway applies a particular tier unless it reports it. Dimensions and quality are separate settings.
- PNG, JPEG, and WebP downloads use the actual encoded bytes. If the gateway returns PNG despite a different request, the browser converts the returned image at the original dimensions. A remote source must permit CORS; if it does not, the site keeps the preview and explains how to save the original instead.
- The former provider/model remain on a compatible three-size profile while changing production secrets. The capabilities endpoint advertises the configured profile, not a live probe on every page load.
- Light, dark and system theme preferences apply to both the homepage and studio and are stored in the browser.

## Cloudflare Pages production deployment

Connect the GitHub repository to a Pages project and select `main` as the production branch. Use these build settings:

```text
Framework preset: None
Build command: exit 0
Build output directory: public
Root directory: /
```

Set the project's **Production** variables and secrets separately from Git:

```text
IMAGE_API_BASE_URL=https://api.zyuou.com
IMAGE_API_KEY=<private production secret>
IMAGE_MODEL=gpt-image-2.6
IMAGE_API_TRANSPORT=fetch
IMAGE_UPSTREAM_TIMEOUT_MS=600000
```

Do not commit a real API key. `IMAGE_API_TRANSPORT` may be left unset for the new provider; if an old value of `socket` is present, remove it or change it to `fetch`. With no explicit `IMAGE_MODEL`, the new endpoint selects 2.6 and the historical endpoint selects 2. Re-deploy after changing bindings and verify `/api/health` and `/api/capabilities`; configuration health is not a live generation test. The streaming route sends a heartbeat every eight seconds during generation.

## Local development

Copy `.env.example` to `.env`, set a server-side key and run `npm install` then `npm start` (http://localhost:4173). The Express runner shares image handlers with Pages. Use `npm run smoke` with the local server running; set `SMOKE_BASE_URL` to test another deployment. Run `node --test scripts/image-release.test.mjs` for mocked image and video-gate checks that do not consume a generation credit.

`python scripts/image2_gateway.py` is the legacy command-line diagnostic; use the site or the shared handlers to exercise 2.6 custom settings.
