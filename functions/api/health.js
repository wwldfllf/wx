import { getConfig, json } from "../_lib/image-api.js";

export function onRequestGet({ env }) {
  const config = getConfig(env);

  return json({
    ok: Boolean(config.apiBaseUrl && config.apiKey),
    configured: Boolean(config.apiBaseUrl && config.apiKey),
    baseUrl: config.apiBaseUrl ? maskHost(config.apiBaseUrl) : null,
    variables: {
      IMAGE_API_BASE_URL: Boolean(config.apiBaseUrl),
      IMAGE_API_KEY: Boolean(config.apiKey),
      IMAGE_MODEL: config.defaultModel,
      IMAGE_MODEL_CONFIGURED: config.configuredModel || null,
      IMAGE_UPSTREAM_TIMEOUT_MS: config.upstreamTimeoutMs
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
