import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 12 * 1024 * 1024
  }
});

const PORT = Number(process.env.PORT || 4173);
const API_BASE_URL = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL);
const API_KEY = process.env.IMAGE_API_KEY;
const DEFAULT_MODEL = process.env.IMAGE_MODEL || "gpt-image-2";

const FALLBACK_CAPABILITIES = {
  models: [createModelCapabilities(DEFAULT_MODEL)],
  defaultModel: DEFAULT_MODEL,
  source: "fallback"
};

const STATIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(STATIC_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: Boolean(API_BASE_URL && API_KEY),
    configured: Boolean(API_BASE_URL && API_KEY),
    baseUrl: API_BASE_URL ? maskHost(API_BASE_URL) : null
  });
});

app.get("/api/capabilities", async (_req, res) => {
  if (!API_BASE_URL || !API_KEY) {
    res.status(500).json({
      error: "后端尚未配置 IMAGE_API_BASE_URL 或 IMAGE_API_KEY。"
    });
    return;
  }

  try {
    const models = await fetchModels();
    const imageModels = models
      .map((model) => (typeof model === "string" ? model : model?.id))
      .filter(Boolean)
      .filter(isLikelyImageModel);

    const uniqueModels = [...new Set(imageModels)];
    const modelIds = uniqueModels.length ? uniqueModels : [DEFAULT_MODEL];

    res.json({
      models: modelIds.map(createModelCapabilities),
      defaultModel: modelIds.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : modelIds[0],
      source: uniqueModels.length ? "models-endpoint" : "fallback"
    });
  } catch (error) {
    res.json({
      ...FALLBACK_CAPABILITIES,
      warning: `模型探测失败，已使用默认能力表：${error.message}`
    });
  }
});

app.post("/api/generate", upload.single("image"), async (req, res) => {
  if (!API_BASE_URL || !API_KEY) {
    res.status(500).json({
      error: "后端尚未配置 IMAGE_API_BASE_URL 或 IMAGE_API_KEY。"
    });
    return;
  }

  const prompt = String(req.body.prompt || "").trim();
  const model = String(req.body.model || DEFAULT_MODEL).trim();
  const size = String(req.body.size || "auto").trim();
  const quality = String(req.body.quality || "auto").trim();
  const outputFormat = String(req.body.output_format || "png").trim();

  if (!prompt) {
    res.status(400).json({ error: "请先输入图片提示词。" });
    return;
  }

  try {
    const hasReferenceImage = Boolean(req.file);
    const result = hasReferenceImage
      ? await createImageEdit({
          image: req.file,
          model,
          prompt,
          size,
          quality,
          outputFormat
        })
      : await createImage({
          model,
          prompt,
          size,
          quality,
          outputFormat
        });

    const images = normalizeImageResults(result, outputFormat);

    if (!images.length) {
      res.status(502).json({
        error: "图片接口已响应，但没有返回可显示的图片。",
        raw: result
      });
      return;
    }

    res.json({
      images,
      model,
      mode: hasReferenceImage ? "image" : "text",
      created: result.created || Date.now()
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "生成失败，请稍后重试。",
      details: error.details
    });
  }
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/") || !req.accepts("html")) {
    next();
    return;
  }

  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Image2 Studio is running at http://localhost:${PORT}`);
});

function normalizeBaseUrl(value) {
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

function maskHost(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "configured";
  }
}

async function fetchModels() {
  const response = await apiFetch("/v1/models", {
    method: "GET"
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "无法从后端 API 探测模型列表。");
  }

  return Array.isArray(body.data) ? body.data : [];
}

function isLikelyImageModel(modelId) {
  const id = modelId.toLowerCase();
  return (
    id.includes("image") ||
    id.includes("dall") ||
    id.includes("flux") ||
    id.includes("sd") ||
    id.includes("midjourney")
  );
}

function createModelCapabilities(id) {
  const lower = id.toLowerCase();
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

async function createImage({ model, prompt, size, quality, outputFormat }) {
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

  const response = await apiFetch("/v1/images/generations", {
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

async function createImageEdit({ image, model, prompt, size, quality, outputFormat }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  appendOptionalFormValue(form, "size", size);
  appendOptionalFormValue(form, "quality", quality);
  appendOptionalFormValue(form, "output_format", outputFormat);
  form.append(
    "image",
    new Blob([image.buffer], { type: image.mimetype || "image/png" }),
    image.originalname || "reference.png"
  );

  const response = await apiFetch("/v1/images/edits", {
    method: "POST",
    body: form
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "图加文生图请求失败。");
  }

  return body;
}

function appendOptionalFormValue(form, key, value) {
  if (value && value !== "auto") {
    form.append(key, value);
  } else if (value === "auto") {
    form.append(key, value);
  }
}

function isGptImageModel(model) {
  return String(model || "")
    .toLowerCase()
    .includes("gpt-image");
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([_key, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function apiFetch(endpoint, options) {
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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

function normalizeImageResults(result, requestedFormat) {
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
