const state = {
  capabilities: null,
  selectedImage: null,
  lastObjectUrl: null
};

const elements = {
  form: document.querySelector("#generateForm"),
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

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateImage();
  });
}

async function loadCapabilities() {
  try {
    const response = await fetch("/api/capabilities");
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "后端能力探测失败。");
    }

    state.capabilities = body;
    renderModels(body.models || [], body.defaultModel);
    setStatus("ready", body.source === "models-endpoint" ? "后端已连接，模型已探测" : "后端已连接，使用默认参数");

    if (body.warning) {
      showMessage(body.warning);
    }
  } catch (error) {
    const fallback = {
      models: [
        {
          id: "gpt-image-1",
          label: "gpt-image-1",
          sizes: ["1024x1024", "1024x1536", "1536x1024", "auto"],
          qualities: ["auto", "low", "medium", "high"],
          formats: ["png", "jpeg", "webp"]
        }
      ],
      defaultModel: "gpt-image-1"
    };

    state.capabilities = fallback;
    renderModels(fallback.models, fallback.defaultModel);
    setStatus("error", "后端探测失败");
    showMessage(error.message, "error");
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

  if (!prompt) {
    showMessage("请先输入提示词。", "error");
    elements.prompt.focus();
    return;
  }

  setLoading(true);
  hideMessage();

  try {
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("model", elements.model.value);
    formData.append("size", elements.size.value);
    formData.append("quality", elements.quality.value);
    formData.append("output_format", elements.outputFormat.value);

    if (state.selectedImage) {
      formData.append("image", state.selectedImage);
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      body: formData
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || "生成失败。");
    }

    const image = body.images?.[0];
    if (!image?.src) {
      throw new Error("接口没有返回可显示的图片。");
    }

    showResult(image.src, elements.outputFormat.value);

    if (image.revisedPrompt) {
      showMessage(`模型优化后的提示词：${image.revisedPrompt}`);
    }
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
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

  if (isLoading) {
    elements.emptyState.hidden = true;
    elements.resultImage.hidden = true;
    elements.downloadButton.hidden = true;
  } else if (!elements.resultImage.src) {
    elements.emptyState.hidden = false;
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

function setStatus(type, text) {
  elements.statusPill.classList.remove("ready", "error");
  if (type) elements.statusPill.classList.add(type);
  elements.statusText.textContent = text;
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
