import { createImage, createImageEdit, normalizeImageResults } from "./image-api.js";
import { parseImageSettings } from "./image-profile.js";

export async function generateFromRequest(request, config) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    throw Object.assign(new Error("无法读取生成表单。"), { status: 400 });
  }
  return generateFromFormData(formData, config);
}

export async function generateFromFormData(formData, config) {
  const settings = parseImageSettings(formData, config.defaultModel);
  const result = await (settings.image ? createImageEdit(config, settings) : createImage(config, settings));
  const images = normalizeImageResults(result);
  if (!images.length) {
    throw Object.assign(new Error("上游没有返回可预览的图片。"), { status: 502 });
  }
  return {
    images,
    model: settings.model,
    size: settings.size,
    requestedFormat: settings.outputFormat,
    mode: settings.image ? "image" : "text",
    created: result.created || Date.now()
  };
}
