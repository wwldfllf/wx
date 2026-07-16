import { json } from "../../../_lib/image-api.js";
import {
  assertVideoConfigured,
  getVideoConfig,
  getVideoTask
} from "../../../_lib/video-api.js";

export async function onRequestGet({ env, params }) {
  const config = getVideoConfig(env);
  const configError = assertVideoConfigured(config, json);
  if (configError) return configError;

  try {
    return json(await getVideoTask(config, String(params.id || "")));
  } catch (error) {
    return json(
      {
        error: error.message || "视频任务查询失败。",
        details: error.details
      },
      { status: error.status || 500 }
    );
  }
}
