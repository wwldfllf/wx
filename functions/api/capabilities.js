import { createModelCapabilities } from "../_lib/image-profile.js";
import { assertConfigured, getConfig, json } from "../_lib/image-api.js";

export function onRequestGet({ env }) {
  const config = getConfig(env);
  return assertConfigured(config) || json({
    models: [createModelCapabilities(config.defaultModel)],
    defaultModel: config.defaultModel,
    source: "provider-profile"
  });
}
