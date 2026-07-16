import { getConfig, json } from "../_lib/image-api.js";
import { getVideoConfig } from "../_lib/video-api.js";

export function onRequestGet({ env }) {
  const config = getConfig(env);
  const videoConfig = getVideoConfig(env);

  return json({
    ok: Boolean(config.apiBaseUrl && config.apiKey),
    configured: Boolean(config.apiBaseUrl && config.apiKey),
    baseUrl: config.apiBaseUrl ? maskHost(config.apiBaseUrl) : null,
    transport: config.apiTransport,
    variables: {
      IMAGE_API_BASE_URL: Boolean(config.apiBaseUrl),
      IMAGE_API_KEY: Boolean(config.apiKey),
      IMAGE_MODEL: config.defaultModel,
      IMAGE_MODEL_CONFIGURED: config.configuredModel || null,
      IMAGE_API_TRANSPORT_CONFIGURED: config.configuredTransport || null,
      IMAGE_UPSTREAM_TIMEOUT_MS_CONFIGURED: config.configuredUpstreamTimeoutMs || null,
      IMAGE_UPSTREAM_TIMEOUT_MS: config.upstreamTimeoutMs,
      ARK_API_KEY: Boolean(videoConfig.apiKey),
      ARK_VIDEO_MODEL: videoConfig.model || null
    }
  });
}

function maskHost(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "configured";
  }
}
