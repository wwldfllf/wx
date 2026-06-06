export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {})
    }
  });
}

export function getConfig(env) {
  return {
    apiBaseUrl: normalizeBaseUrl(env.IMAGE_API_BASE_URL),
    apiKey: env.IMAGE_API_KEY || "",
    defaultModel: env.IMAGE_MODEL || "gpt-image-2"
  };
}

export function assertConfigured(config) {
  if (!config.apiBaseUrl || !config.apiKey) {
    return json(
      {
        error: "Cloudflare 环境变量尚未配置 IMAGE_API_BASE_URL 或 IMAGE_API_KEY。"
      },
      { status: 500 }
    );
  }

  return null;
}

export function fallbackCapabilities(defaultModel) {
  return {
    models: [createModelCapabilities(defaultModel)],
    defaultModel,
    source: "fallback"
  };
}

export async function fetchModels(config) {
  const response = await apiFetch(config, "/v1/models", {
    method: "GET"
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw createApiError(response, body, "无法从后端 API 探测模型列表。");
  }

  return Array.isArray(body.data) ? body.data : [];
}

export function isLikelyImageModel(modelId) {
  const id = String(modelId || "").toLowerCase();
  return (
    id.includes("image") ||
    id.includes("dall") ||
    id.includes("flux") ||
    id.includes("sd") ||
    id.includes("midjourney")
  );
}

export function createModelCapabilities(id) {
  const lower = String(id || "").toLowerCase();
  const isGptImage = lower.includes("gpt-image");
  const isGptImage2 = lower.includes("gpt-image-2");

  if (isGptImage2) {
    return {
      id,
      label: id,
      sizes: [
        "auto",
        "1024x1024",
        "1536x1024",
        "1024x1536",
        "1536x864",
        "864x1536",
        "1440x1080",
        "1080x1440",
        "1536x768",
        "768x1536"
      ],
      qualities: ["auto", "low", "medium", "high"],
      formats: ["png", "jpeg", "webp"],
      modes: ["text", "image"]
    };
  }

  if (isGptImage) {
    return {
      id,
      label: id,
      sizes: ["1024x1024", "1024x1536", "1536x1024", "auto"],
      qualities: ["auto", "low", "medium", "high"],
      formats: ["png", "jpeg", "webp"],
      modes: ["text", "image"]
    };
  }

  return {
    id,
    label: id,
    sizes: ["1024x1024", "1024x1792", "1792x1024", "auto"],
    qualities: ["standard", "hd", "auto"],
    formats: ["png", "jpeg", "webp"],
    modes: ["text", "image"]
  };
}

export async function createImage(config, { model, prompt, size, quality, outputFormat }) {
  const payload = compactObject({
    model,
    prompt,
    size,
    quality,
    output_format: outputFormat,
    n: 1
  });

  if (!isGptImageModel(model)) {
    payload.response_format = "b64_json";
  }

  const response = await apiFetch(config, "/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "文生图请求失败。");
  }

  return body;
}

export async function createImageEdit(config, { image, model, prompt, size, quality, outputFormat }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  appendOptionalFormValue(form, "size", size);
  appendOptionalFormValue(form, "quality", quality);
  appendOptionalFormValue(form, "output_format", outputFormat);
  form.append("image", image, image.name || "reference.png");

  const response = await apiFetch(config, "/v1/images/edits", {
    method: "POST",
    body: form
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "图加文生图请求失败。");
  }

  return body;
}

export function normalizeImageResults(result, requestedFormat) {
  const data = Array.isArray(result?.data) ? result.data : [];
  const images = [];

  for (const item of data) {
    if (!item) continue;

    if (item.b64_json) {
      images.push({
        src: toDataUrl(item.b64_json, item.output_format || requestedFormat),
        mimeType: mimeTypeFor(item.output_format || requestedFormat),
        revisedPrompt: item.revised_prompt || ""
      });
      continue;
    }

    if (item.url) {
      images.push({
        src: item.url,
        mimeType: mimeTypeFor(requestedFormat),
        revisedPrompt: item.revised_prompt || ""
      });
      continue;
    }

    if (typeof item === "string") {
      images.push({
        src: item.startsWith("data:") ? item : toDataUrl(item, requestedFormat),
        mimeType: mimeTypeFor(requestedFormat),
        revisedPrompt: ""
      });
    }
  }

  if (result?.b64_json) {
    images.push({
      src: toDataUrl(result.b64_json, requestedFormat),
      mimeType: mimeTypeFor(requestedFormat),
      revisedPrompt: result.revised_prompt || ""
    });
  }

  if (result?.url) {
    images.push({
      src: result.url,
      mimeType: mimeTypeFor(requestedFormat),
      revisedPrompt: result.revised_prompt || ""
    });
  }

  return images;
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([_key, value]) => value !== undefined && value !== null && value !== "")
  );
}

function appendOptionalFormValue(form, key, value) {
  if (value) {
    form.append(key, value);
  }
}

function isGptImageModel(model) {
  return String(model || "")
    .toLowerCase()
    .includes("gpt-image");
}

function apiFetch(config, endpoint, options) {
  return fetch(`${config.apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(options.headers || {})
    }
  });
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function createApiError(response, body, fallbackMessage) {
  const message =
    body?.error?.message ||
    body?.message ||
    body?.error ||
    body?.text ||
    fallbackMessage;

  const error = new Error(String(message));
  error.status = response.status >= 400 && response.status < 600 ? response.status : 500;
  error.details = body;
  return error;
}

function toDataUrl(value, format) {
  if (value.startsWith("data:")) return value;
  return `data:${mimeTypeFor(format)};base64,${value}`;
}

function mimeTypeFor(format) {
  const normalized = String(format || "png").replace("jpg", "jpeg").toLowerCase();
  if (normalized === "webp") return "image/webp";
  if (normalized === "jpeg") return "image/jpeg";
  return "image/png";
}
