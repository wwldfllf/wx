export const DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
export const DEFAULT_VIDEO_MODEL = "doubao-seedance-2-0-mini";

const ALLOWED_RATIOS = new Set(["16:9", "9:16", "1:1"]);
const ALLOWED_RESOLUTIONS = new Set(["480p", "720p"]);
const MAX_PROMPT_LENGTH = 4000;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 60000;

export function getVideoConfig(env = {}) {
  return {
    apiKey: String(env.ARK_API_KEY || "").trim(),
    apiBaseUrl: normalizeBaseUrl(env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL),
    model: String(env.ARK_VIDEO_MODEL || DEFAULT_VIDEO_MODEL).trim()
  };
}

export function videoCapabilities(config) {
  return {
    configured: Boolean(config.apiKey && config.model),
    model: {
      id: config.model,
      label: "Doubao Seedance 2.0 Mini"
    },
    ratios: Array.from(ALLOWED_RATIOS),
    resolutions: Array.from(ALLOWED_RESOLUTIONS),
    duration: { min: 4, max: 15, default: 5 },
    supportsFirstFrame: true,
    supportsAudio: true,
    source: "volcengine-ark"
  };
}

export function assertVideoConfigured(config, json) {
  if (config.apiKey && config.model) return null;
  return json(
    {
      error: "Cloudflare environment variables ARK_API_KEY or ARK_VIDEO_MODEL are not configured."
    },
    { status: 500 }
  );
}

export function parseVideoForm(formData) {
  const prompt = String(formData.get("prompt") || "").trim();
  if (!prompt) throw videoError(400, "请先输入视频提示词。");
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw videoError(400, `视频提示词不能超过 ${MAX_PROMPT_LENGTH} 个字符。`);
  }

  const ratio = String(formData.get("ratio") || "16:9").trim();
  const resolution = String(formData.get("resolution") || "720p").trim().toLowerCase();
  const duration = Number(formData.get("duration") || 5);
  const generateAudio = String(formData.get("generate_audio") || "true") !== "false";
  if (!ALLOWED_RATIOS.has(ratio)) throw videoError(400, "不支持的视频比例。");
  if (!ALLOWED_RESOLUTIONS.has(resolution)) throw videoError(400, "不支持的视频清晰度。");
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
    throw videoError(400, "视频时长必须为 4 到 15 秒的整数。");
  }

  const firstFrame = formData.get("first_frame");
  if (firstFrame instanceof Blob && firstFrame.size) {
    if (!isAcceptedImageType(firstFrame.type)) {
      throw videoError(400, "首帧参考图仅支持 PNG、JPEG 或 WebP。");
    }
    if (firstFrame.size > MAX_REFERENCE_BYTES) {
      throw videoError(400, "首帧参考图不能超过 20 MB。");
    }
  }

  return {
    prompt,
    ratio,
    resolution,
    duration,
    generateAudio,
    firstFrame: firstFrame instanceof Blob && firstFrame.size ? firstFrame : null
  };
}

export async function createVideoTask(config, input) {
  const content = [
    {
      type: "text",
      text: buildVideoPrompt(input)
    }
  ];

  if (input.firstFrame) {
    content.push({
      type: "image_url",
      image_url: {
        url: await blobToDataUrl(input.firstFrame)
      },
      role: "first_frame"
    });
  }

  const body = await arkRequest(config, "/contents/generations/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      content
    })
  });

  const taskId = body.id || body.task_id || body.taskId;
  if (!taskId) throw videoError(502, "方舟没有返回视频任务 ID。", body);
  return {
    taskId,
    model: config.model,
    ratio: input.ratio,
    resolution: input.resolution,
    duration: input.duration
  };
}

export async function getVideoTask(config, taskId) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(taskId)) {
    throw videoError(400, "无效的视频任务 ID。");
  }
  const body = await arkRequest(
    config,
    `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    { method: "GET" }
  );

  const videoUrl =
    body?.content?.video_url ||
    body?.content?.videoUrl ||
    body?.output?.video_url ||
    body?.output?.videoUrl ||
    body?.video_url ||
    body?.videoUrl ||
    "";
  return {
    taskId: body.id || body.task_id || taskId,
    status: normalizeTaskStatus(body.status || body.state),
    progress: Number.isFinite(Number(body.progress)) ? Number(body.progress) : null,
    videoUrl,
    error: extractArkError(body),
    model: body.model || config.model,
    modelLabel: "Doubao Seedance 2.0 Mini",
    ratio: body.ratio || "",
    duration: body.duration || null
  };
}

export function videoError(status, message, details = undefined) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function buildVideoPrompt(input) {
  return [
    input.prompt,
    `--ratio ${input.ratio}`,
    `--resolution ${input.resolution}`,
    `--duration ${input.duration}`,
    `--generate_audio ${input.generateAudio}`,
    "--watermark false"
  ].join(" ");
}

async function arkRequest(config, endpoint, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(options.headers || {})
      }
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw videoError(
        response.status,
        extractArkError(body) || `方舟视频接口请求失败（HTTP ${response.status}）。`,
        body
      );
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      throw videoError(504, "连接方舟视频接口超时。");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 1000) };
  }
}

function extractArkError(body) {
  if (!body) return "";
  if (typeof body.error === "string") return body.error;
  return body.error?.message || body.message || body.content?.error || "";
}

function normalizeTaskStatus(status) {
  const value = String(status || "").toLowerCase();
  const aliases = {
    success: "succeeded",
    completed: "succeeded",
    cancelled: "cancelled",
    canceled: "cancelled",
    error: "failed"
  };
  return aliases[value] || value || "unknown";
}

function isAcceptedImageType(type) {
  return ["image/png", "image/jpeg", "image/webp"].includes(String(type || "").toLowerCase());
}

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}
