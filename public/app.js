const GENERATION_TIMEOUT_MS = 630000;
const DEFAULT_SERVER_TIMEOUT_MS = 600000;
const CAPABILITY_TIMEOUT_MS = 30000;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const FALLBACK_CAPABILITIES = {
  models: [
    {
      id: "gpt-image-2",
      label: "GPT Image 2",
      sizes: ["1024x1024", "1536x1024", "1024x1536"],
      qualities: ["gateway-default"],
      formats: ["png"],
      modes: ["text", "image"]
    }
  ],
  defaultModel: "gpt-image-2",
  source: "fallback"
};

const SIZE_LABELS = {
  auto: "自动比例",
  "1024x1024": "正方形 · 1:1",
  "1024x1536": "纵向 · 2:3",
  "1536x1024": "横向 · 3:2",
  "1536x864": "横向 · 16:9",
  "864x1536": "纵向 · 9:16",
  "1440x1080": "横向 · 4:3",
  "1080x1440": "纵向 · 3:4",
  "1536x768": "宽幅 · 2:1",
  "768x1536": "长图 · 1:2",
  "1024x1792": "纵向 · 9:16",
  "1792x1024": "横向 · 16:9"
};

const QUALITY_LABELS = {
  auto: "自动",
  "gateway-default": "智能匹配",
  low: "快速",
  medium: "标准",
  high: "精细",
  standard: "标准",
  hd: "高清"
};

const FORMAT_LABELS = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP"
};

const state = {
  backendReady: false,
  capabilities: null,
  selectedImage: null,
  referenceObjectUrl: null,
  lastResult: null,
  generationController: null,
  generationStartedAt: 0,
  serverTimeoutMs: DEFAULT_SERVER_TIMEOUT_MS,
  progressTimer: null
};

const elements = {
  form: document.querySelector("#generateForm"),
  prompt: document.querySelector("#prompt"),
  promptCount: document.querySelector("#promptCount"),
  model: document.querySelector("#model"),
  size: document.querySelector("#size"),
  quality: document.querySelector("#quality"),
  outputFormat: document.querySelector("#outputFormat"),
  imageInput: document.querySelector("#imageInput"),
  uploadZone: document.querySelector("#uploadZone"),
  clearImageButton: document.querySelector("#clearImageButton"),
  referencePreview: document.querySelector("#referencePreview"),
  referenceImage: document.querySelector("#referenceImage"),
  referenceName: document.querySelector("#referenceName"),
  referenceMeta: document.querySelector("#referenceMeta"),
  modeLabel: document.querySelector("#modeLabel"),
  capabilitySource: document.querySelector("#capabilitySource"),
  statusPill: document.querySelector("#statusPill"),
  statusText: document.querySelector("#statusText"),
  submitButton: document.querySelector("#submitButton"),
  resultStage: document.querySelector("#resultStage"),
  resultImage: document.querySelector("#resultImage"),
  emptyState: document.querySelector("#emptyState"),
  loadingState: document.querySelector("#loadingState"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingMeta: document.querySelector("#loadingMeta"),
  progressBar: document.querySelector("#progressBar"),
  downloadButton: document.querySelector("#downloadButton"),
  resultFooter: document.querySelector("#resultFooter"),
  resultModel: document.querySelector("#resultModel"),
  resultSize: document.querySelector("#resultSize"),
  resultDuration: document.querySelector("#resultDuration"),
  messageBox: document.querySelector("#messageBox")
};

init();

async function init() {
  window.lucide?.createIcons?.();
  bindEvents();
  updatePromptCount();
  renderCapabilities(FALLBACK_CAPABILITIES);
  setStageRatio(elements.size.value || "1024x1024");
  await loadCapabilities();
}

function bindEvents() {
  elements.prompt.addEventListener("input", updatePromptCount);

  elements.prompt.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });

  elements.model.addEventListener("change", () => {
    renderParameterOptions(getSelectedModel());
  });

  elements.size.addEventListener("change", () => {
    setStageRatio(elements.size.value);
  });

  elements.imageInput.addEventListener("change", () => {
    const file = elements.imageInput.files?.[0];
    if (file) setReferenceImage(file);
  });

  elements.clearImageButton.addEventListener("click", clearReferenceImage);

  for (const eventName of ["dragenter", "dragover"]) {
    elements.uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadZone.classList.add("dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    elements.uploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.uploadZone.classList.remove("dragging");
    });
  }

  elements.uploadZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) setReferenceImage(file);
  });

  document.addEventListener("paste", (event) => {
    const image = Array.from(event.clipboardData?.files || []).find((file) =>
      ACCEPTED_IMAGE_TYPES.has(file.type)
    );
    if (image) setReferenceImage(image);
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateImage();
  });
}

async function loadCapabilities() {
  setStatus("checking", "正在连接 API");
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CAPABILITY_TIMEOUT_MS);

  try {
    const response = await fetch("/api/capabilities", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(body) || `HTTP ${response.status}`);
    }

    if (!Array.isArray(body.models) || !body.models.length) {
      throw new Error("后端没有返回可用的图片模型。");
    }

    state.backendReady = true;
    renderCapabilities(body);
    elements.capabilitySource.textContent = "API 实时探测";
    elements.submitButton.disabled = false;
    setStatus("ready", "API 已连接");
  } catch (error) {
    state.backendReady = false;
    elements.submitButton.disabled = true;
    elements.capabilitySource.textContent = "探测失败";
    setStatus("error", "后端未连接");

    const message =
      error.name === "AbortError"
        ? "后端能力探测超过 30 秒，请稍后刷新页面。"
        : `后端连接失败：${error.message}`;
    showMessage(message, "error");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function renderCapabilities(capabilities) {
  state.capabilities = capabilities;
  renderModels(capabilities.models, capabilities.defaultModel);
}

function renderModels(models, defaultModel) {
  const previous = elements.model.value;
  elements.model.replaceChildren();

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = modelDisplayName(model);
    elements.model.append(option);
  }

  const preferred = models.some((model) => model.id === previous) ? previous : defaultModel;
  if (preferred) elements.model.value = preferred;
  elements.model.disabled = models.length <= 1;
  renderParameterOptions(getSelectedModel());
}

function renderParameterOptions(model) {
  fillSelect(elements.size, model?.sizes || ["1024x1024"], SIZE_LABELS);
  fillSelect(elements.quality, model?.qualities || ["gateway-default"], QUALITY_LABELS);
  fillSelect(elements.outputFormat, model?.formats || ["png"], FORMAT_LABELS);
  setStageRatio(elements.size.value);
}

function fillSelect(select, values, labels) {
  const current = select.value;
  select.replaceChildren();

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value] || value;
    select.append(option);
  }

  if (values.includes(current)) select.value = current;
  select.disabled = values.length <= 1;
}

function getSelectedModel() {
  return state.capabilities?.models?.find((model) => model.id === elements.model.value);
}

function modelDisplayName(model) {
  if (model.label && model.label !== model.id) return model.label;
  if (String(model.id).toLowerCase() === "gpt-image-2") return "GPT Image 2";
  return model.id;
}

function updatePromptCount() {
  elements.promptCount.textContent = `${elements.prompt.value.length} / 8000`;
}

function setReferenceImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    showMessage("参考图仅支持 PNG、JPEG 或 WebP。", "error");
    return;
  }

  if (file.size > MAX_REFERENCE_BYTES) {
    showMessage("参考图不能超过 20 MB。", "error");
    return;
  }

  state.selectedImage = file;
  if (state.referenceObjectUrl) URL.revokeObjectURL(state.referenceObjectUrl);
  state.referenceObjectUrl = URL.createObjectURL(file);

  elements.referenceImage.src = state.referenceObjectUrl;
  elements.referenceName.textContent = file.name || "pasted-image.png";
  elements.referenceMeta.textContent = `${formatBytes(file.size)} · 图加文模式`;
  elements.referencePreview.hidden = false;
  elements.uploadZone.hidden = true;
  elements.modeLabel.textContent = "图加文";
  hideMessage();
}

function clearReferenceImage() {
  state.selectedImage = null;
  elements.imageInput.value = "";
  elements.referencePreview.hidden = true;
  elements.uploadZone.hidden = false;
  elements.modeLabel.textContent = "文生图";

  if (state.referenceObjectUrl) {
    URL.revokeObjectURL(state.referenceObjectUrl);
    state.referenceObjectUrl = null;
  }
}

async function generateImage() {
  const prompt = elements.prompt.value.trim();

  if (!state.backendReady) {
    showMessage("后端尚未连接，请刷新页面后重试。", "error");
    return;
  }

  if (!prompt) {
    showMessage("请先输入画面描述。", "error");
    elements.prompt.focus();
    return;
  }

  state.generationController?.abort();
  const controller = new AbortController();
  state.generationController = controller;
  state.generationStartedAt = Date.now();
  state.serverTimeoutMs = DEFAULT_SERVER_TIMEOUT_MS;

  const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", elements.model.value);
  formData.append("size", elements.size.value);
  formData.append("quality", elements.quality.value);
  formData.append("output_format", elements.outputFormat.value);
  if (state.selectedImage) {
    formData.append("image", state.selectedImage, state.selectedImage.name || "reference.png");
  }

  setLoading(true);
  hideMessage();
  startProgressTimer();

  try {
    const result = await generateWithStream(formData, controller.signal);
    const elapsedMs = Date.now() - state.generationStartedAt;
    showResult(result, elapsedMs);
    setStatus("ready", "生成完成");
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "本次生成已等待超过 10 分 30 秒，连接已结束。"
        : formatGenerateError(error.status, error.message, error.details);
    showMessage(message, "error");
    setStatus("error", "生成失败");
  } finally {
    window.clearTimeout(timeoutId);
    stopProgressTimer();
    setLoading(false);
    state.generationController = null;
  }
}

async function generateWithStream(formData, signal) {
  const response = await fetch("/api/generate-stream", {
    method: "POST",
    body: formData,
    signal,
    headers: { Accept: "application/x-ndjson" },
    cache: "no-store"
  });

  if (!response.ok || !response.body) {
    const body = await readResponseBody(response);
    throw createRequestError(response.status, getApiErrorMessage(body), body.details);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        const result = handleStreamEvent(parseStreamEvent(line));
        if (result) return result;
      }
      newline = buffer.indexOf("\n");
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const result = handleStreamEvent(parseStreamEvent(buffer.trim()));
    if (result) return result;
  }

  throw createRequestError(502, "生成连接已结束，但没有收到图片结果。", {});
}

function parseStreamEvent(line) {
  try {
    return JSON.parse(line);
  } catch {
    throw createRequestError(502, "后端返回了无法解析的生成状态。", {});
  }
}

function handleStreamEvent(event) {
  if (event.type === "start") {
    state.serverTimeoutMs = Number(event.timeoutMs) || DEFAULT_SERVER_TIMEOUT_MS;
    updateProgress();
    return null;
  }

  if (event.type === "progress") {
    state.serverTimeoutMs = Number(event.timeoutMs) || state.serverTimeoutMs;
    updateProgress(Number(event.elapsedMs));
    return null;
  }

  if (event.type === "done") {
    return event.result;
  }

  if (event.type === "error") {
    throw createRequestError(event.status || 500, event.error, event.details);
  }

  return null;
}

function createRequestError(status, message, details) {
  const error = new Error(message || "图片生成失败。");
  error.status = Number(status) || 500;
  error.details = details || {};
  return error;
}

function startProgressTimer() {
  stopProgressTimer();
  updateProgress(0);
  state.progressTimer = window.setInterval(() => updateProgress(), 1000);
}

function stopProgressTimer() {
  if (state.progressTimer) window.clearInterval(state.progressTimer);
  state.progressTimer = null;
}

function updateProgress(explicitElapsedMs) {
  const elapsedMs =
    explicitElapsedMs ?? Math.max(0, Date.now() - (state.generationStartedAt || Date.now()));
  const timeoutMs = Math.max(state.serverTimeoutMs, DEFAULT_SERVER_TIMEOUT_MS);
  const percent = Math.min(96, Math.max(2, (elapsedMs / timeoutMs) * 100));

  elements.progressBar.style.width = `${percent}%`;
  elements.loadingTitle.textContent = progressPhase(elapsedMs);
  elements.loadingMeta.textContent = `已等待 ${formatDuration(elapsedMs)} · 最长约 ${formatDuration(timeoutMs)}`;
}

function progressPhase(elapsedMs) {
  if (elapsedMs < 15000) return "正在理解描述";
  if (elapsedMs < 60000) return "正在构建画面";
  if (elapsedMs < 180000) return "正在绘制细节";
  return "正在完成高质量渲染";
}

function showResult(result, elapsedMs) {
  const image = result?.images?.[0];
  if (!image?.src) {
    throw createRequestError(502, "接口没有返回可显示的图片。", {});
  }

  state.lastResult = {
    src: image.src,
    model: result.model || elements.model.value,
    size: elements.size.value,
    format: elements.outputFormat.value,
    elapsedMs
  };

  elements.resultImage.classList.remove("reveal");
  elements.resultImage.onload = () => {
    requestAnimationFrame(() => elements.resultImage.classList.add("reveal"));
  };
  elements.resultImage.src = image.src;
  if (elements.resultImage.complete) {
    requestAnimationFrame(() => elements.resultImage.classList.add("reveal"));
  }
  elements.resultImage.hidden = false;
  elements.emptyState.hidden = true;
  elements.loadingState.hidden = true;

  elements.downloadButton.href = image.src;
  elements.downloadButton.download = createDownloadName(elements.outputFormat.value);
  elements.downloadButton.hidden = false;

  elements.resultModel.textContent = modelDisplayName({ id: state.lastResult.model });
  elements.resultSize.textContent = state.lastResult.size.replace("x", " × ");
  elements.resultDuration.textContent = `${formatDuration(elapsedMs)}完成`;
  elements.resultFooter.hidden = false;

  if (image.revisedPrompt) {
    showMessage(`优化后的画面描述：${image.revisedPrompt}`);
  }
}

function setLoading(isLoading) {
  elements.submitButton.classList.toggle("is-loading", isLoading);
  elements.submitButton.disabled = isLoading || !state.backendReady;
  elements.submitButton.querySelector("span").textContent = isLoading ? "正在生成" : "生成图片";
  elements.loadingState.hidden = !isLoading;

  if (isLoading) {
    elements.resultImage.hidden = true;
    elements.emptyState.hidden = true;
    elements.downloadButton.hidden = true;
    elements.resultFooter.hidden = true;
    setStatus("busy", "正在生成图片");
    return;
  }

  if (state.lastResult) {
    elements.resultImage.hidden = false;
    elements.emptyState.hidden = true;
    elements.downloadButton.hidden = false;
    elements.resultFooter.hidden = false;
  } else {
    elements.resultImage.hidden = true;
    elements.emptyState.hidden = false;
    elements.downloadButton.hidden = true;
    elements.resultFooter.hidden = true;
  }
}

function setStageRatio(size) {
  const match = String(size || "").match(/^(\d+)x(\d+)$/);
  const ratio = match ? `${match[1]} / ${match[2]}` : "1 / 1";
  elements.resultStage.style.setProperty("--result-ratio", ratio);
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

function setStatus(type, text) {
  elements.statusPill.classList.remove("checking", "ready", "busy", "error");
  if (type) elements.statusPill.classList.add(type);
  elements.statusText.textContent = text;
}

function formatGenerateError(status, message, details = {}) {
  const detail = normalizeErrorMessage(message);

  if (status === 401 || status === 403) {
    return `后端 API Key 无效或没有模型权限。${appendDetail(detail)}`;
  }

  if (status === 502) {
    return `上游图片服务暂时不可用（502）。${appendDetail(detail)}`;
  }

  if (status === 504 || status === 524) {
    const waited = details.elapsedMs ? `，已等待 ${formatDuration(details.elapsedMs)}` : "";
    return `上游图片服务超时（${status}${waited}）。${appendDetail(detail)}`;
  }

  return detail || `图片生成失败（HTTP ${status || 500}）。`;
}

function appendDetail(detail) {
  return detail ? ` 详情：${detail}` : "";
}

function normalizeErrorMessage(message) {
  const value = String(message || "").trim();
  const translations = {
    "Upstream image API timed out. Try a lower quality or a smaller image size.":
      "后端已按 10 分钟等待，但上游仍未返回结果。",
    "Upstream image API timed out.": "上游提前结束了生成请求。",
    "Text-to-image request failed.": "文生图请求未成功。",
    "Image-plus-text request failed.": "图加文请求未成功。"
  };
  return translations[value] || value;
}

function getApiErrorMessage(body) {
  if (typeof body?.error === "string") return body.error;
  return body?.error?.message || body?.message || "";
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
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

function createDownloadName(format) {
  const extension = format === "jpeg" ? "jpg" : format || "png";
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  return `image-studio-${timestamp}.${extension}`;
}
