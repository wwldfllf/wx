export const IMAGE2_MODEL = "gpt-image-2";
export const IMAGE26_MODEL = "gpt-image-2.6";

const LEGACY_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const CUSTOM_SIZE = { min: 512, max: 2048, step: 16, minPixels: 655360, maxRatio: 2 };
const FORMATS = ["png", "jpeg", "webp"];

export function selectImageModel(baseUrl, configuredModel) {
  if ([IMAGE2_MODEL, IMAGE26_MODEL].includes(configuredModel)) return configuredModel;
  try {
    return new URL(baseUrl).hostname === "api.zyuou.com" ? IMAGE26_MODEL : IMAGE2_MODEL;
  } catch {
    return IMAGE2_MODEL;
  }
}

export function createModelCapabilities(model) {
  const modern = model === IMAGE26_MODEL;
  return {
    id: model,
    label: modern ? "GPT Image 2.6" : "GPT Image 2",
    sizes: modern ? [...LEGACY_SIZES, "1024x768", "768x1024", "1280x1024", "1024x1280", "1536x864", "864x1536", "1536x768", "768x1536"] : LEGACY_SIZES,
    customSize: modern ? CUSTOM_SIZE : null,
    qualities: modern ? ["auto", "low", "medium", "high"] : ["gateway-default"],
    formats: FORMATS,
    modes: ["text", "image"]
  };
}

export function parseImageSettings(form, model) {
  const profile = createModelCapabilities(model);
  const prompt = String(form.get("prompt") || "").trim();
  const size = String(form.get("size") || profile.sizes[0]).trim().toLowerCase();
  const quality = String(form.get("quality") || profile.qualities[0]).trim();
  const outputFormat = String(form.get("output_format") || profile.formats[0]).trim();
  if (!prompt || prompt.length > 8000) throw invalid("请输入 1–8000 字的画面描述。");
  if (!profile.sizes.includes(size) && !validCustomSize(size, profile.customSize)) {
    throw invalid(profile.customSize
      ? "宽高须在 512–2048 px 之间，均为 16 的倍数，总像素至少 655,360，长边不超过短边的 2 倍。"
      : "当前供应商仅支持正方形、横向 3:2 和纵向 2:3。");
  }
  if (!profile.qualities.includes(quality)) throw invalid("当前模型不支持所选生成质量。");
  if (!profile.formats.includes(outputFormat)) throw invalid("不支持所选下载格式。");
  const image = form.get("image");
  const reference = typeof image === "object" && image?.size > 0 ? image : null;
  if (reference && (reference.size > 20 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(reference.type))) {
    throw invalid("参考图须为 PNG、JPEG 或 WebP，且不超过 20 MB。");
  }
  return { model, prompt, size, quality, outputFormat, image: reference };
}

function validCustomSize(size, limits) {
  if (!limits || !/^\d{3,4}x\d{3,4}$/.test(size)) return false;
  const [width, height] = size.split("x").map(Number);
  return [width, height].every((n) => n >= limits.min && n <= limits.max && n % limits.step === 0) &&
    width * height >= limits.minPixels && Math.max(width, height) <= Math.min(width, height) * limits.maxRatio;
}

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}
