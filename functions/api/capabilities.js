import {
  assertConfigured,
  createModelCapabilities,
  getConfig,
  IMAGE2_MODEL,
  json
} from "../_lib/image-api.js";

export async function onRequestGet({ env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  return json({
    models: [createModelCapabilities(IMAGE2_MODEL)],
    defaultModel: IMAGE2_MODEL,
    source: "image2-docs"
  });
}
