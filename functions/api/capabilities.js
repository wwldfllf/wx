import {
  assertConfigured,
  createModelCapabilities,
  fallbackCapabilities,
  fetchModels,
  getConfig,
  isLikelyImageModel,
  json
} from "../_lib/image-api.js";

export async function onRequestGet({ env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  try {
    const models = await fetchModels(config);
    const imageModels = models
      .map((model) => (typeof model === "string" ? model : model?.id))
      .filter(Boolean)
      .filter(isLikelyImageModel);

    const uniqueModels = [...new Set(imageModels)];
    const modelIds = uniqueModels.length ? uniqueModels : [config.defaultModel];

    return json({
      models: modelIds.map(createModelCapabilities),
      defaultModel: modelIds.includes(config.defaultModel) ? config.defaultModel : modelIds[0],
      source: uniqueModels.length ? "models-endpoint" : "fallback"
    });
  } catch (error) {
    return json({
      ...fallbackCapabilities(config.defaultModel),
      warning: `模型探测失败，已使用默认能力表：${error.message}`
    });
  }
}
