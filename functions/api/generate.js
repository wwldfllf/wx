import {
  assertConfigured,
  getConfig,
  json
} from "../_lib/image-api.js";
import { generateFromRequest } from "../_lib/generate-handler.js";

export async function onRequestPost({ request, env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  try {
    return json(await generateFromRequest(request, config));
  } catch (error) {
    return json(
      {
        error: error.message || "Generation failed. Please try again later.",
        details: error.details
      },
      { status: error.status || 500 }
    );
  }
}
