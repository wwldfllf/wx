const GENERATE_TIMEOUT_MS = 300000;
const DIRECT_API_BASE_URL = "https://api.codeyu.shop";
const API_KEY_STORAGE_KEY = "image2-studio-api-key";

const state = {
  capabilities: null,
  selectedImage: null,
  lastObjectUrl: null
};

const elements = {
  form: document.querySelector("#generateForm"),
  apiKey: document.querySelector("#apiKey"),
  rememberKey: document.querySelector("#rememberKey"),
  prompt: document.querySelector("#prompt"),
  model: document.querySelector("#model"),
  size: document.querySelector("#size"),
  quality: document.querySelector("#quality"),
  outputFormat: document.querySelector("#outputFormat"),
  imageInput: document.querySelector("#imageInput"),
  clearImageButton: document.querySelector("#clearImageButton"),
  referencePreview: document.querySelector("#referencePreview"),
  referenceImage: document.querySelector("#referenceImage"),
  referenceName: document.querySelector("#referenceName"),
  referenceMeta: document.querySelector("#referenceMeta"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  submitButton: document.querySelector("#submitButton"),
  resultImage: document.querySelector("#resultImage"),
  emptyState: document.querySelector("#emptyState"),
  loadingState: document.querySelector("#loadingState"),
  downloadButton: document.querySelector("#downloadButton"),
  messageBox: document.querySelector("#messageBox")
};

const SIZE_LABELS = {
  auto: "自动",
  "1024x1024": "正方形 1:1",
  "1024x1536": "竖图 2:3",
  "1536x1024": "横图 3:2",
  "1536x864": "横图 16:9",
  "864x1536": "竖图 9:16",
  "1440x1080": "横图 4:3",
  "1080x1440": "竖图 3:4",
  "1536x768": "宽幅 2:1",
  "768x1536": "长图 1:2",
  "1024x1792": "竖图 9:16",
  "1792x1024": "横图 16:9"
};

const QUALITY_LABELS = {
  auto: "自动",
  "gateway-default": "网关默认",
  low: "低",
  medium: "中",
  high: "高",
  standard: "标准",
  hd: "高清"
};

const FORMAT_LABELS = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP"
};

init();

async function init() {
  restoreApiKey();
  bindEvents();
  await loadCapabilities();
}

function bindEvents() {
  elements.model.addEventListener("change", () => {
    renderParameterOptions(getSelectedModel());
  });

  elements.imageInput.addEventListener("change", () => {
    const file = elements.imageInput.files?.[0];
    if (file) setReferenceImage(file);
  });

  elements.clearImageButton.addEventListener("click", () => {
    clearReferenceImage();
  });

  elements.rememberKey.addEventListener("change", () => {
    if (!elements.rememberKey.checked) {
      try {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      } catch {
        // Private browsing modes may disable local storage.
      }
    }
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateImage();
  });
}

async function loadCapabilities() {
  const capabilities = {
    models: [
      {
        id: "gpt-image-2",
        label: "gpt-image-2",
        sizes: ["1024x1024", "1536x1024", "1024x1536"],
        qualities: ["gateway-default"],
        formats: ["png"]
      }
    ],
    defaultModel: "gpt-image-2"
  };

  state.capabilities = capabilities;
  renderModels(capabilities.models, capabilities.defaultModel);
  setStatus("ready", "直连 API 已就绪");
}

function restoreApiKey() {
  try {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!storedKey) return;
    elements.apiKey.value = storedKey;
    elements.rememberKey.checked = true;
  } catch {
    elements.rememberKey.checked = false;
  }
}

function persistApiKey(apiKey) {
  try {
    if (elements.rememberKey.checked) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    elements.rememberKey.checked = false;
  }
}

function renderModels(models, defaultModel) {
  elements.model.innerHTML = "";

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label || model.id;
    option.selected = model.id === defaultModel;
    elements.model.append(option);
  }

  renderParameterOptions(getSelectedModel());
}

function renderParameterOptions(model) {
  fillSelect(elements.size, model?.sizes || ["auto"], SIZE_LABELS);
  fillSelect(elements.quality, model?.qualities || ["auto"], QUALITY_LABELS);
  fillSelect(elements.outputFormat, model?.formats || ["png"], FORMAT_LABELS);
}

function fillSelect(select, values, labels) {
  const current = select.value;
  select.innerHTML = "";

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value] || value;
    select.append(option);
  }

  if (values.includes(current)) {
    select.value = current;
  }
}

function getSelectedModel() {
  return state.capabilities?.models?.find((model) => model.id === elements.model.value);
}

function setReferenceImage(file) {
  state.selectedImage = file;

  if (state.lastObjectUrl) URL.revokeObjectURL(state.lastObjectUrl);
  state.lastObjectUrl = URL.createObjectURL(file);

  elements.referenceImage.src = state.lastObjectUrl;
  elements.referenceName.textContent = file.name;
  elements.referenceMeta.textContent = `${formatBytes(file.size)} · 图加文模式`;
  elements.referencePreview.hidden = false;
  elements.clearImageButton.disabled = false;
}

function clearReferenceImage() {
  state.selectedImage = null;
  elements.imageInput.value = "";
  elements.referencePreview.hidden = true;
  elements.clearImageButton.disabled = true;

  if (state.lastObjectUrl) {
    URL.revokeObjectURL(state.lastObjectUrl);
    state.lastObjectUrl = null;
  }
}

async function generateImage() {
  const prompt = elements.prompt.value.trim();
  const apiKey = elements.apiKey.value.trim();

  if (!prompt) {
    showMessage("请先输入提示词。", "error");
    elements.prompt.focus();
    return;
  }

  if (!apiKey) {
    showMessage("请先输入 API Key。", "error");
    elements.apiKey.focus();
    return;
  }

  persistApiKey(apiKey);
  setLoading(true);
  hideMessage();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  const startedAt = Date.now();
  const progressId = window.setInterval(() => {
    setProgressMessage(Date.now() - startedAt, GENERATE_TIMEOUT_MS);
  }, 1000);

  try {
    const body = await generateDirectImage({
      apiKey,
      prompt,
      model: elements.model.value,
      size: elements.size.value,
      image: state.selectedImage,
      signal: controller.signal
    });
    handleGenerationResult(body);
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "生成超过 5 分钟未完成。请降低清晰度、换小比例，或稍后重试。"
        : error.message;
    showMessage(message, "error");
  } finally {
    window.clearTimeout(timeoutId);
    window.clearInterval(progressId);
    setLoading(false);
  }
}

async function generateDirectImage({ apiKey, prompt, model, size, image, signal }) {
  const hasReferenceImage = image instanceof File && image.size > 0;
  const endpoint = hasReferenceImage ? "/v1/images/edits" : "/v1/images/generations";
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  let requestBody;

  if (hasReferenceImage) {
    requestBody = new FormData();
    requestBody.append("model", model);
    requestBody.append("prompt", prompt);
    requestBody.append("size", size);
    requestBody.append("image[]", image, image.name || "reference.png");
  } else {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify({
      model,
      prompt,
      size
    });
  }

  const response = await fetch(`${DIRECT_API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: requestBody,
    signal,
    headers,
    cache: "no-store",
    credentials: "omit"
  });
  const responseBody = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(
      formatGenerateError(response.status, getApiErrorMessage(responseBody), {
        endpoint,
        transport: "browser-direct"
      })
    );
  }

  const images = normalizeDirectImageResults(responseBody);
  if (!images.length) {
    throw new Error("接口没有返回可显示的图片。");
  }

  return {
    images,
    model: responseBody.model || model,
    mode: hasReferenceImage ? "image" : "text",
    created: responseBody.created || Date.now()
  };
}

function normalizeDirectImageResults(result) {
  const data = Array.isArray(result?.data) ? result.data : [];

  return data
    .map((item) => {
      if (!item) return null;
      const src = item.b64_json
        ? `data:image/png;base64,${item.b64_json}`
        : item.url || "";
      if (!src) return null;

      return {
        src,
        revisedPrompt: item.revised_prompt || ""
      };
    })
    .filter(Boolean);
}

function getApiErrorMessage(body) {
  if (typeof body?.error === "string") return body.error;
  return body?.error?.message || body?.message || "图片接口请求失败。";
}

function handleGenerationResult(body) {
  const image = body.images?.[0];
  if (!image?.src) {
    throw new Error("接口没有返回可显示的图片。");
  }

  showResult(image.src, elements.outputFormat.value);

  if (image.revisedPrompt) {
    showMessage(`模型优化后的提示词：${image.revisedPrompt}`);
  }
}

function setProgressMessage(elapsedMs, timeoutMs) {
  const elapsed = elapsedMs ? formatDuration(elapsedMs) : "等待中";
  const limit = timeoutMs ? formatDuration(timeoutMs) : "5 分钟";
  elements.loadingState.querySelector("p").textContent = `正在生成，已等待 ${elapsed}，最长约 ${limit}`;
}

function showResult(src, format) {
  elements.resultImage.src = src;
  elements.resultImage.hidden = false;
  elements.emptyState.hidden = true;
  elements.downloadButton.hidden = false;
  elements.downloadButton.href = src;
  elements.downloadButton.download = `image2-studio-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.${extensionFor(format)}`;
}

function setLoading(isLoading) {
  elements.submitButton.disabled = isLoading;
  elements.loadingState.hidden = !isLoading;
  elements.submitButton.querySelector("span:last-child").textContent = isLoading ? "正在生成" : "生成图片";
  elements.loadingState.querySelector("p").textContent = "正在生成，请稍候";

  if (isLoading) {
    elements.emptyState.hidden = true;
    elements.resultImage.hidden = true;
    elements.downloadButton.hidden = true;
  } else if (elements.resultImage.src) {
    elements.resultImage.hidden = false;
    elements.emptyState.hidden = true;
    elements.downloadButton.hidden = false;
  } else {
    elements.emptyState.hidden = false;
    elements.downloadButton.hidden = true;
  }
}

function showMessage(message, type = "info") {
  elements.messageBox.textContent = message;
  elements.messageBox.classList.toggle("error", type === "error");
  elements.messageBox.hidden = false;
}

function hideMessage() {
  elements.messageBox.hidden = true;
  elements.messageBox.textContent = "";
  elements.messageBox.classList.remove("error");
}

function formatGenerateError(status, message, details = {}) {
  if (status === 502) {
    return `上游图片接口返回 502，通常是 API 网关或模型服务暂时不可用。${formatErrorDetails(message, details)}`;
  }

  if (status === 504) {
    return `API 网关提前结束了本次生图请求。网站会等待最多 5 分钟；如果已等待不是 5 分钟，说明是上游服务先返回了 504。${formatErrorDetails(message, details)}`;
  }

  return message || `生成失败，HTTP ${status}。`;
}

function formatErrorDetails(message, details) {
  const parts = [];
  if (message) parts.push(`详情：${normalizeErrorMessage(message)}`);
  if (details?.endpoint) parts.push(`接口：${details.endpoint}`);
  if (details?.transport) parts.push(`通道：${details.transport}`);
  if (details?.elapsedMs) parts.push(`已等待：${formatDuration(details.elapsedMs)}`);
  if (details?.timeoutMs) parts.push(`限制：${formatDuration(details.timeoutMs)}`);
  return parts.length ? parts.join("；") : "";
}

function normalizeErrorMessage(message) {
  if (message === "Upstream image API timed out. Try a lower quality or a smaller image size.") {
    return "网站后端已按 5 分钟等待，但上游图片接口仍未返回结果。";
  }

  if (message === "Upstream image API timed out.") {
    return "上游图片接口返回 504，生成请求被上游提前结束。";
  }

  return message;
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function setStatus(type, text) {
  elements.statusPill.classList.remove("ready", "error");
  if (type) elements.statusPill.classList.add(type);
  elements.statusText.textContent = text;
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text.slice(0, 300)
    };
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function extensionFor(format) {
  if (format === "jpeg") return "jpg";
  if (format === "webp") return "webp";
  return "png";
}
