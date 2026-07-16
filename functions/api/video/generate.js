import { json } from "../../_lib/image-api.js";
import {
  assertVideoConfigured,
  createVideoTask,
  getVideoConfig,
  parseVideoForm
} from "../../_lib/video-api.js";

export async function onRequestPost({ request, env }) {
  const config = getVideoConfig(env);
  const configError = assertVideoConfigured(config, json);
  if (configError) return configError;

  try {
    const formData = await request.formData();
    return json(await createVideoTask(config, parseVideoForm(formData)));
  } catch (error) {
    return json(
      {
        error: error.message || "视频任务创建失败。",
        details: error.details
      },
      { status: error.status || 500 }
    );
  }
}
