const GENERATION_TIMEOUT_MS = 630000;
const DEFAULT_SERVER_TIMEOUT_MS = 600000;
const CAPABILITY_TIMEOUT_MS = 30000;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ENTER_TRANSITION_MS = 1550;
const RETURN_TRANSITION_MS = 1350;
const PLATFORM_TRANSITION_MS = 900;
const VIDEO_TASK_TIMEOUT_MS = 30 * 60 * 1000;
const VIDEO_POLL_INTERVAL_MS = 5000;
const WELCOME_PAGES = new Set(["home", "explore", "gallery", "pricing", "about"]);

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
  progressTimer: null,
  sceneTransitioning: false,
  welcomePage: "home",
  activePlatform: "image",
  platformSwitching: false,
  sizeMenuOpen: false,
  sizeMenuFocusIndex: 0,
  videoBackendReady: false,
  videoCapabilities: null,
  selectedVideoImage: null,
  videoReferenceObjectUrl: null,
  videoTaskController: null,
  videoTaskStartedAt: 0,
  videoProgressTimer: null,
  lastVideoResult: null
};

const elements = {
  welcomeExperience: document.querySelector("#welcomeExperience"),
  welcomeHero: document.querySelector("#welcomeHero"),
  startStudioButton: document.querySelector("#startStudioButton"),
  welcomePages: Array.from(document.querySelectorAll("[data-page]")),
  welcomeNavButtons: Array.from(document.querySelectorAll("[data-welcome-page]")),
  galleryDialog: document.querySelector("#galleryDialog"),
  galleryDialogImage: document.querySelector("#galleryDialogImage"),
  galleryDialogTitle: document.querySelector("#galleryDialogTitle"),
  galleryDialogClose: document.querySelector("#galleryDialogClose"),
  studioExperience: document.querySelector("#studioExperience"),
  studioBrand: document.querySelector("#studioBrand"),
  platformSwitch: document.querySelector("#platformSwitch"),
  platformStage: document.querySelector("#platformStage"),
  platformTabs: Array.from(document.querySelectorAll("[data-platform]")),
  platformPanes: Array.from(document.querySelectorAll("[data-platform-pane]")),
  pageTitle: document.querySelector("#pageTitle"),
  form: document.querySelector("#generateForm"),
  prompt: document.querySelector("#prompt"),
  promptCount: document.querySelector("#promptCount"),
  model: document.querySelector("#model"),
  size: document.querySelector("#size"),
  sizeMenu: document.querySelector("#sizeMenu"),
  sizeMenuButton: document.querySelector("#sizeMenuButton"),
  sizeMenuValue: document.querySelector("#sizeMenuValue"),
  sizeMenuList: document.querySelector("#sizeMenuList"),
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
  messageBox: document.querySelector("#messageBox"),
  videoForm: document.querySelector("#videoGenerateForm"),
  videoPrompt: document.querySelector("#videoPrompt"),
  videoPromptCount: document.querySelector("#videoPromptCount"),
  videoImageInput: document.querySelector("#videoImageInput"),
  videoUploadZone: document.querySelector("#videoUploadZone"),
  clearVideoImageButton: document.querySelector("#clearVideoImageButton"),
  videoReferencePreview: document.querySelector("#videoReferencePreview"),
  videoReferenceImage: document.querySelector("#videoReferenceImage"),
  videoReferenceName: document.querySelector("#videoReferenceName"),
  videoReferenceMeta: document.querySelector("#videoReferenceMeta"),
  videoModeLabel: document.querySelector("#videoModeLabel"),
  videoCapabilitySource: document.querySelector("#videoCapabilitySource"),
  videoModel: document.querySelector("#videoModel"),
  videoResolution: document.querySelector("#videoResolution"),
  videoDuration: document.querySelector("#videoDuration"),
  videoDurationValue: document.querySelector("#videoDurationValue"),
  videoAudio: document.querySelector("#videoAudio"),
  videoSubmitButton: document.querySelector("#videoSubmitButton"),
  videoResultStage: document.querySelector("#videoResultStage"),
  videoEmptyState: document.querySelector("#videoEmptyState"),
  videoLoadingState: document.querySelector("#videoLoadingState"),
  videoLoadingTitle: document.querySelector("#videoLoadingTitle"),
  videoLoadingMeta: document.querySelector("#videoLoadingMeta"),
  videoProgressBar: document.querySelector("#videoProgressBar"),
  resultVideo: document.querySelector("#resultVideo"),
  videoDownloadButton: document.querySelector("#videoDownloadButton"),
  videoResultFooter: document.querySelector("#videoResultFooter"),
  videoResultModel: document.querySelector("#videoResultModel"),
  videoResultRatio: document.querySelector("#videoResultRatio"),
  videoResultDuration: document.querySelector("#videoResultDuration"),
  videoMessageBox: document.querySelector("#videoMessageBox")
};

init();

async function init() {
  window.lucide?.createIcons?.();
  initializeExperience();
  bindEvents();
  updatePromptCount();
  updateVideoPromptCount();
  updateVideoDuration();
  renderCapabilities(FALLBACK_CAPABILITIES);
  setStageRatio(elements.size.value || "1024x1024");
  setVideoStageRatio(selectedVideoRatio());
  await Promise.all([loadCapabilities(), loadVideoCapabilities()]);
}

function bindEvents() {
  elements.startStudioButton.addEventListener("click", () => enterStudio(true));

  elements.platformTabs.forEach((button) => {
    button.addEventListener("click", () => switchPlatform(button.dataset.platform));
  });

  elements.sizeMenuButton.addEventListener("click", () => toggleSizeMenu());
  elements.sizeMenuButton.addEventListener("keydown", handleSizeMenuKeydown);
  elements.sizeMenuList.addEventListener("keydown", handleSizeMenuKeydown);
  document.addEventListener("pointerdown", (event) => {
    if (state.sizeMenuOpen && !elements.sizeMenu.contains(event.target)) closeSizeMenu();
  });

  elements.welcomeNavButtons.forEach((button) => {
    button.addEventListener("click", () => showWelcomePage(button.dataset.welcomePage, true));
  });

  document.querySelectorAll("[data-enter-studio]").forEach((button) => {
    button.addEventListener("click", () => enterStudio(true));
  });

  document.querySelectorAll("[data-prompt-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      elements.prompt.value = button.dataset.promptPreset || "";
      updatePromptCount();
      enterStudio(true);
      window.setTimeout(
        () => elements.prompt.focus({ preventScroll: true }),
        transitionDuration(ENTER_TRANSITION_MS) + 40
      );
    });
  });

  document.querySelectorAll(".gallery-item").forEach((button) => {
    button.addEventListener("click", () => openGalleryItem(button));
  });

  elements.galleryDialogClose.addEventListener("click", () => elements.galleryDialog.close());
  elements.galleryDialog.addEventListener("click", (event) => {
    if (event.target === elements.galleryDialog) elements.galleryDialog.close();
  });

  elements.studioBrand.addEventListener("click", (event) => {
    event.preventDefault();
    returnToWelcome(true, "home");
  });

  document.querySelector(".welcome-brand")?.addEventListener("click", (event) => {
    event.preventDefault();
    showWelcomePage("home", true);
  });

  window.addEventListener("popstate", syncExperienceToLocation);
  window.addEventListener("hashchange", syncExperienceToLocation);

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
    syncSizeMenuSelection();
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
    if (!image) return;
    if (state.activePlatform === "video") setVideoReferenceImage(image);
    else setReferenceImage(image);
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateImage();
  });

  elements.videoPrompt.addEventListener("input", updateVideoPromptCount);
  elements.videoPrompt.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      elements.videoForm.requestSubmit();
    }
  });

  elements.videoImageInput.addEventListener("change", () => {
    const file = elements.videoImageInput.files?.[0];
    if (file) setVideoReferenceImage(file);
  });
  elements.clearVideoImageButton.addEventListener("click", clearVideoReferenceImage);

  for (const eventName of ["dragenter", "dragover"]) {
    elements.videoUploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.videoUploadZone.classList.add("dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    elements.videoUploadZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.videoUploadZone.classList.remove("dragging");
    });
  }
  elements.videoUploadZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) setVideoReferenceImage(file);
  });

  elements.videoDuration.addEventListener("input", updateVideoDuration);
  document.querySelectorAll('input[name="video_ratio"]').forEach((input) => {
    input.addEventListener("change", () => setVideoStageRatio(input.value));
  });
  elements.videoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await generateVideo();
  });
}

function switchPlatform(platform) {
  if (
    !["image", "video"].includes(platform) ||
    platform === state.activePlatform ||
    state.platformSwitching
  ) {
    return;
  }

  closeSizeMenu();
  state.platformSwitching = true;
  const current = elements.platformPanes.find((pane) => pane.dataset.platformPane === state.activePlatform);
  const incoming = elements.platformPanes.find((pane) => pane.dataset.platformPane === platform);
  if (!current || !incoming) {
    state.platformSwitching = false;
    return;
  }

  elements.platformTabs.forEach((button) => {
    button.disabled = true;
    const active = button.dataset.platform === platform;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.platformSwitch.dataset.active = platform;

  const startHeight = current.getBoundingClientRect().height;
  const duration = transitionDuration(PLATFORM_TRANSITION_MS);
  elements.platformStage.style.height = `${startHeight}px`;
  elements.platformStage.style.overflow = "hidden";

  current.classList.add("leaving");
  current.classList.remove("active");
  current.setAttribute("aria-hidden", "true");
  current.inert = true;

  incoming.classList.add("active");
  incoming.setAttribute("aria-hidden", "false");
  incoming.inert = false;
  const targetHeight = incoming.scrollHeight;
  const incomingAnimation = incoming.animate(
    [
      { opacity: 0, transform: "translateY(28px) scale(0.988)" },
      { opacity: 1, transform: "translateY(0) scale(1)" }
    ],
    {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both"
    }
  );
  const stageAnimation = elements.platformStage.animate(
    [{ height: `${startHeight}px` }, { height: `${targetHeight}px` }],
    {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both"
    }
  );

  state.activePlatform = platform;
  updatePlatformStatus();

  window.setTimeout(() => {
    incomingAnimation.cancel();
    stageAnimation.cancel();
    current.classList.remove("leaving");
    elements.platformStage.style.height = "";
    elements.platformStage.style.overflow = "";
    elements.platformTabs.forEach((button) => {
      button.disabled = false;
    });
    state.platformSwitching = false;
  }, duration);
}

function updatePlatformStatus() {
  if (state.activePlatform === "video") {
    if (state.videoTaskController) setStatus("busy", "正在生成视频");
    else if (state.videoBackendReady) setStatus("ready", "视频服务已连接");
    else setStatus("error", "视频服务未配置");
    return;
  }

  if (state.generationController) setStatus("busy", "正在生成图片");
  else if (state.backendReady) setStatus("ready", "图片服务已连接");
  else setStatus("error", "图片服务未连接");
}

function renderSizeMenu() {
  const options = Array.from(elements.size.options);
  elements.sizeMenuList.replaceChildren();

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "glass-select-option";
    button.dataset.value = option.value;
    button.dataset.index = String(index);
    button.id = `size-option-${index}`;
    button.setAttribute("role", "option");

    const shape = document.createElement("span");
    shape.className = "ratio-shape";
    const dimensions = ratioShapeDimensions(option.value);
    shape.style.setProperty("--ratio-width", `${dimensions.width}px`);
    shape.style.setProperty("--ratio-height", `${dimensions.height}px`);

    const label = document.createElement("strong");
    label.textContent = option.textContent;

    const check = document.createElement("span");
    check.className = "option-check";
    check.setAttribute("aria-hidden", "true");

    button.append(shape, label, check);
    button.addEventListener("click", () => selectSizeOption(option.value));
    button.addEventListener("pointermove", () => {
      state.sizeMenuFocusIndex = index;
      syncSizeMenuFocus();
    });
    elements.sizeMenuList.append(button);
  });

  syncSizeMenuSelection();
}

function ratioShapeDimensions(value) {
  const match = String(value).match(/^(\d+)x(\d+)$/);
  if (!match) return { width: 22, height: 18 };
  const ratio = Number(match[1]) / Number(match[2]);
  if (ratio >= 1) return { width: 24, height: Math.max(11, Math.round(24 / ratio)) };
  return { width: Math.max(11, Math.round(24 * ratio)), height: 24 };
}

function selectSizeOption(value) {
  if (!Array.from(elements.size.options).some((option) => option.value === value)) return;
  elements.size.value = value;
  elements.size.dispatchEvent(new Event("change", { bubbles: true }));
  closeSizeMenu({ returnFocus: true });
}

function syncSizeMenuSelection() {
  const selected = elements.size.selectedOptions[0];
  elements.sizeMenuValue.textContent = selected?.textContent || SIZE_LABELS[elements.size.value] || "选择比例";
  const optionButtons = Array.from(elements.sizeMenuList.querySelectorAll(".glass-select-option"));
  optionButtons.forEach((button, index) => {
    const active = button.dataset.value === elements.size.value;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-selected", String(active));
    if (active) state.sizeMenuFocusIndex = index;
  });
  syncSizeMenuFocus();
}

function syncSizeMenuFocus() {
  const options = Array.from(elements.sizeMenuList.querySelectorAll(".glass-select-option"));
  options.forEach((button, index) => button.classList.toggle("focused", index === state.sizeMenuFocusIndex));
  const focused = options[state.sizeMenuFocusIndex];
  if (focused) elements.sizeMenuButton.setAttribute("aria-activedescendant", focused.id);
}

function toggleSizeMenu(forceOpen) {
  const open = typeof forceOpen === "boolean" ? forceOpen : !state.sizeMenuOpen;
  if (open) openSizeMenu();
  else closeSizeMenu();
}

function openSizeMenu({ focusOption = false } = {}) {
  if (state.sizeMenuOpen) return;
  state.sizeMenuOpen = true;
  elements.sizeMenu.classList.add("open");
  elements.sizeMenuButton.setAttribute("aria-expanded", "true");
  syncSizeMenuSelection();
  if (focusOption) {
    requestAnimationFrame(() => {
      elements.sizeMenuList.querySelectorAll(".glass-select-option")[state.sizeMenuFocusIndex]?.focus();
    });
  }
}

function closeSizeMenu({ returnFocus = false } = {}) {
  if (!state.sizeMenuOpen) return;
  state.sizeMenuOpen = false;
  elements.sizeMenu.classList.remove("open");
  elements.sizeMenuButton.setAttribute("aria-expanded", "false");
  if (returnFocus) elements.sizeMenuButton.focus({ preventScroll: true });
}

function handleSizeMenuKeydown(event) {
  const options = Array.from(elements.sizeMenuList.querySelectorAll(".glass-select-option"));
  if (!options.length) return;

  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    if (!state.sizeMenuOpen) openSizeMenu();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    state.sizeMenuFocusIndex =
      (state.sizeMenuFocusIndex + direction + options.length) % options.length;
    syncSizeMenuFocus();
    options[state.sizeMenuFocusIndex].focus();
    return;
  }

  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    if (!state.sizeMenuOpen) openSizeMenu({ focusOption: true });
    else selectSizeOption(options[state.sizeMenuFocusIndex].dataset.value);
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeSizeMenu({ returnFocus: true });
  }
}

function showWelcomePage(pageName, updateHistory) {
  const page = WELCOME_PAGES.has(pageName) ? pageName : "home";
  state.welcomePage = page;
  document.body.dataset.welcomeView = page;

  elements.welcomePages.forEach((section) => {
    const active = section.dataset.page === page;
    section.classList.toggle("active", active);
    section.setAttribute("aria-hidden", String(!active));
    section.inert = !active;
    if (active) section.scrollTop = 0;
  });

  elements.welcomeNavButtons.forEach((button) => {
    const active = button.dataset.welcomePage === page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  if (updateHistory && window.location.hash !== `#${page}`) {
    window.history.pushState({ view: "welcome", page }, "", `#${page}`);
  }
}

function openGalleryItem(button) {
  const image = button.querySelector("img");
  if (!image) return;
  elements.galleryDialogImage.src = image.currentSrc || image.src;
  elements.galleryDialogImage.alt = image.alt;
  elements.galleryDialogTitle.textContent = button.dataset.galleryTitle || image.alt;
  elements.galleryDialog.showModal();
}

function initializeExperience() {
  if (window.location.hash === "#studio") {
    showStudioImmediately();
    return;
  }

  showWelcomeImmediately(welcomePageFromHash());
}

function showWelcomeImmediately(page = "home") {
  document.body.classList.remove("studio-active", "scene-transitioning", "scene-returning");
  document.body.classList.add("welcome-active");
  elements.welcomeExperience.hidden = false;
  elements.welcomeExperience.setAttribute("aria-hidden", "false");
  elements.welcomeExperience.inert = false;
  elements.studioExperience.setAttribute("aria-hidden", "true");
  elements.studioExperience.inert = true;
  showWelcomePage(page, false);
  window.dispatchEvent(new CustomEvent("studio:welcome"));
}

function showStudioImmediately() {
  document.body.classList.remove("welcome-active", "scene-transitioning", "scene-returning");
  document.body.classList.add("studio-active");
  elements.welcomeExperience.hidden = true;
  elements.welcomeExperience.setAttribute("aria-hidden", "true");
  elements.welcomeExperience.inert = true;
  elements.studioExperience.setAttribute("aria-hidden", "false");
  elements.studioExperience.inert = false;
  window.dispatchEvent(new CustomEvent("studio:entered"));
}

function enterStudio(updateHistory) {
  if (state.sceneTransitioning || document.body.classList.contains("studio-active")) return;

  state.sceneTransitioning = true;
  elements.studioExperience.setAttribute("aria-hidden", "false");
  elements.studioExperience.inert = false;
  elements.welcomeExperience.setAttribute("aria-hidden", "true");
  document.body.classList.add("scene-transitioning");
  window.dispatchEvent(new CustomEvent("studio:enter"));

  if (updateHistory && window.location.hash !== "#studio") {
    window.history.pushState({ view: "studio" }, "", "#studio");
  }

  window.setTimeout(() => {
    document.body.classList.remove("welcome-active", "scene-transitioning");
    document.body.classList.add("studio-active");
    elements.welcomeExperience.hidden = true;
    elements.welcomeExperience.inert = true;
    window.scrollTo(0, 0);
    elements.studioBrand.focus({ preventScroll: true });
    state.sceneTransitioning = false;
    window.dispatchEvent(new CustomEvent("studio:entered"));
  }, transitionDuration(ENTER_TRANSITION_MS));
}

function returnToWelcome(updateHistory, page = state.welcomePage) {
  if (state.sceneTransitioning || !document.body.classList.contains("studio-active")) return;

  state.sceneTransitioning = true;
  showWelcomePage(page, false);
  elements.welcomeExperience.hidden = false;
  elements.welcomeExperience.inert = false;
  elements.welcomeExperience.setAttribute("aria-hidden", "false");
  elements.studioExperience.setAttribute("aria-hidden", "true");
  elements.studioExperience.inert = true;
  document.body.classList.add("scene-returning");
  window.dispatchEvent(new CustomEvent("studio:welcome"));

  if (updateHistory && window.location.hash !== `#${page}`) {
    window.history.pushState({ view: "welcome", page }, "", `#${page}`);
  }

  window.setTimeout(() => {
    document.body.classList.remove("studio-active", "scene-returning");
    document.body.classList.add("welcome-active");
    window.scrollTo(0, 0);
    elements.welcomeNavButtons.find((button) => button.dataset.welcomePage === page)?.focus({
      preventScroll: true
    });
    state.sceneTransitioning = false;
  }, transitionDuration(RETURN_TRANSITION_MS));
}

function syncExperienceToLocation() {
  if (window.location.hash === "#studio") {
    enterStudio(false);
  } else {
    const page = welcomePageFromHash();
    showWelcomePage(page, false);
    returnToWelcome(false, page);
  }
}

function welcomePageFromHash() {
  const page = window.location.hash.replace(/^#/, "");
  return WELCOME_PAGES.has(page) ? page : "home";
}

function transitionDuration(duration) {
  return prefersReducedMotion() ? 20 : duration;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function loadCapabilities() {
  if (state.activePlatform === "image") setStatus("checking", "正在连接图片服务");
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
    elements.capabilitySource.textContent = "服务实时探测";
    elements.submitButton.disabled = false;
    if (state.activePlatform === "image") setStatus("ready", "图片服务已连接");
  } catch (error) {
    state.backendReady = false;
    elements.submitButton.disabled = true;
    elements.capabilitySource.textContent = "探测失败";
    if (state.activePlatform === "image") setStatus("error", "图片服务未连接");

    const message =
      error.name === "AbortError"
        ? "后端能力探测超过 30 秒，请稍后刷新页面。"
        : `后端连接失败：${error.message}`;
    showMessage(message, "error");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function loadVideoCapabilities() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CAPABILITY_TIMEOUT_MS);

  try {
    const response = await fetch("/api/video/capabilities", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const body = await readResponseBody(response);
    if (!response.ok) throw new Error(getApiErrorMessage(body) || `HTTP ${response.status}`);

    state.videoCapabilities = body;
    state.videoBackendReady = Boolean(body.configured && body.model?.id);
    elements.videoCapabilitySource.textContent = state.videoBackendReady ? "方舟服务已配置" : "后端尚未配置";
    elements.videoSubmitButton.disabled = !state.videoBackendReady;

    if (body.model?.id) {
      elements.videoModel.replaceChildren();
      const option = document.createElement("option");
      const modelLabel = body.model.label || "Seedance 2.0 Mini";
      option.value = body.model.id;
      option.textContent = /seedance\s*2(?:\.0)?\s*mini/i.test(modelLabel)
        ? "Seedance 2.0 Mini"
        : modelLabel;
      elements.videoModel.append(option);
      elements.videoModel.title = modelLabel;
      elements.videoResultModel.textContent = modelLabel;
    }

    replaceSimpleOptions(elements.videoResolution, body.resolutions || ["480p", "720p"], {
      "480p": "480P",
      "720p": "720P"
    });
    if (Array.from(elements.videoResolution.options).some((option) => option.value === "720p")) {
      elements.videoResolution.value = "720p";
    }
    if (state.activePlatform === "video") updatePlatformStatus();
  } catch (error) {
    state.videoBackendReady = false;
    elements.videoSubmitButton.disabled = true;
    elements.videoCapabilitySource.textContent =
      error.name === "AbortError" ? "配置探测超时" : "视频服务不可用";
    if (state.activePlatform === "video") updatePlatformStatus();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function replaceSimpleOptions(select, values, labels = {}) {
  const previous = select.value;
  select.replaceChildren();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labels[value] || value;
    select.append(option);
  });
  if (values.includes(previous)) select.value = previous;
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
  renderSizeMenu();
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

function updateVideoPromptCount() {
  elements.videoPromptCount.textContent = `${elements.videoPrompt.value.length} / 4000`;
}

function setVideoReferenceImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    showVideoMessage("首帧参考图仅支持 PNG、JPEG 或 WebP。", "error");
    return;
  }
  if (file.size > MAX_REFERENCE_BYTES) {
    showVideoMessage("首帧参考图不能超过 20 MB。", "error");
    return;
  }

  state.selectedVideoImage = file;
  if (state.videoReferenceObjectUrl) URL.revokeObjectURL(state.videoReferenceObjectUrl);
  state.videoReferenceObjectUrl = URL.createObjectURL(file);
  elements.videoReferenceImage.src = state.videoReferenceObjectUrl;
  elements.videoReferenceName.textContent = file.name || "first-frame.png";
  elements.videoReferenceMeta.textContent = `${formatBytes(file.size)} · 首帧生视频模式`;
  elements.videoReferencePreview.hidden = false;
  elements.videoUploadZone.hidden = true;
  elements.videoModeLabel.textContent = "首帧生视频";
  hideVideoMessage();
}

function clearVideoReferenceImage() {
  state.selectedVideoImage = null;
  elements.videoImageInput.value = "";
  elements.videoReferencePreview.hidden = true;
  elements.videoUploadZone.hidden = false;
  elements.videoModeLabel.textContent = "文生视频";
  if (state.videoReferenceObjectUrl) {
    URL.revokeObjectURL(state.videoReferenceObjectUrl);
    state.videoReferenceObjectUrl = null;
  }
}

function selectedVideoRatio() {
  return document.querySelector('input[name="video_ratio"]:checked')?.value || "16:9";
}

function setVideoStageRatio(ratio) {
  const match = String(ratio).match(/^(\d+):(\d+)$/);
  const cssRatio = match ? `${match[1]} / ${match[2]}` : "16 / 9";
  elements.videoResultStage.style.setProperty("--video-result-ratio", cssRatio);
}

function updateVideoDuration() {
  const value = Number(elements.videoDuration.value) || 5;
  const min = Number(elements.videoDuration.min) || 4;
  const max = Number(elements.videoDuration.max) || 15;
  const percent = ((value - min) / Math.max(1, max - min)) * 100;
  elements.videoDurationValue.textContent = `${value} 秒`;
  elements.videoDuration.style.setProperty("--range-progress", `${percent}%`);
}

async function generateVideo() {
  const prompt = elements.videoPrompt.value.trim();
  if (!state.videoBackendReady) {
    showVideoMessage("视频后端尚未配置，请检查方舟密钥和模型 ID。", "error");
    return;
  }
  if (!prompt) {
    showVideoMessage("请先输入镜头描述。", "error");
    elements.videoPrompt.focus();
    return;
  }

  const controller = new AbortController();
  state.videoTaskController = controller;
  state.videoTaskStartedAt = Date.now();
  const timeoutId = window.setTimeout(() => controller.abort(), VIDEO_TASK_TIMEOUT_MS);
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", elements.videoModel.value);
  formData.append("ratio", selectedVideoRatio());
  formData.append("resolution", elements.videoResolution.value);
  formData.append("duration", elements.videoDuration.value);
  formData.append("generate_audio", String(elements.videoAudio.checked));
  if (state.selectedVideoImage) {
    formData.append(
      "first_frame",
      state.selectedVideoImage,
      state.selectedVideoImage.name || "first-frame.png"
    );
  }

  setVideoLoading(true);
  hideVideoMessage();
  startVideoProgressTimer();

  try {
    const createResponse = await fetch("/api/video/generate", {
      method: "POST",
      body: formData,
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const createBody = await readResponseBody(createResponse);
    if (!createResponse.ok) {
      throw createRequestError(createResponse.status, getApiErrorMessage(createBody), createBody.details);
    }
    if (!createBody.taskId) {
      throw createRequestError(502, "方舟已响应，但没有返回视频任务 ID。", {});
    }

    elements.videoLoadingTitle.textContent = "视频任务已提交";
    const result = await pollVideoTask(createBody.taskId, controller.signal);
    showVideoResult(result);
    if (state.activePlatform === "video") setStatus("ready", "视频生成完成");
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "视频任务等待超过 30 分钟，本次查询已停止。"
        : formatVideoError(error.status, error.message);
    showVideoMessage(message, "error");
    if (state.activePlatform === "video") setStatus("error", "视频生成失败");
  } finally {
    window.clearTimeout(timeoutId);
    stopVideoProgressTimer();
    state.videoTaskController = null;
    setVideoLoading(false);
  }
}

async function pollVideoTask(taskId, signal) {
  while (!signal.aborted) {
    const response = await fetch(`/api/video/tasks/${encodeURIComponent(taskId)}`, {
      signal,
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const body = await readResponseBody(response);
    if (!response.ok) {
      throw createRequestError(response.status, getApiErrorMessage(body), body.details);
    }

    const status = String(body.status || "").toLowerCase();
    updateVideoTaskProgress(body);
    if (["succeeded", "success", "completed"].includes(status)) {
      if (!body.videoUrl) throw createRequestError(502, "视频任务完成，但没有返回视频地址。", {});
      return body;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw createRequestError(502, body.error || `视频任务状态：${status}`, body);
    }

    await waitForVideoPoll(signal);
  }
  throw new DOMException("Aborted", "AbortError");
}

function waitForVideoPoll(signal) {
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, VIDEO_POLL_INTERVAL_MS);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function updateVideoTaskProgress(task) {
  const status = String(task.status || "").toLowerCase();
  if (["queued", "pending", "created"].includes(status)) {
    elements.videoLoadingTitle.textContent = "正在排队等待算力";
  } else {
    elements.videoLoadingTitle.textContent = "正在生成视频镜头";
  }
  if (Number.isFinite(Number(task.progress))) {
    elements.videoProgressBar.style.width = `${Math.min(98, Math.max(3, Number(task.progress)))}%`;
  }
}

function startVideoProgressTimer() {
  stopVideoProgressTimer();
  updateVideoProgress();
  state.videoProgressTimer = window.setInterval(updateVideoProgress, 1000);
}

function stopVideoProgressTimer() {
  if (state.videoProgressTimer) window.clearInterval(state.videoProgressTimer);
  state.videoProgressTimer = null;
}

function updateVideoProgress() {
  const elapsedMs = Math.max(0, Date.now() - (state.videoTaskStartedAt || Date.now()));
  const percent = Math.min(92, Math.max(2, (elapsedMs / VIDEO_TASK_TIMEOUT_MS) * 100));
  if (!elements.videoProgressBar.style.width || percent > parseFloat(elements.videoProgressBar.style.width)) {
    elements.videoProgressBar.style.width = `${percent}%`;
  }
  elements.videoLoadingMeta.textContent = `已等待 ${formatDuration(elapsedMs)} · 视频任务可能需要数分钟`;
}

function showVideoResult(result) {
  state.lastVideoResult = result;
  elements.resultVideo.src = result.videoUrl;
  elements.resultVideo.hidden = false;
  elements.resultVideo.load();
  elements.videoEmptyState.hidden = true;
  elements.videoLoadingState.hidden = true;
  elements.videoDownloadButton.href = result.videoUrl;
  elements.videoDownloadButton.hidden = false;
  elements.videoResultModel.textContent = result.modelLabel || "Seedance 2.0 Mini";
  elements.videoResultRatio.textContent = result.ratio || selectedVideoRatio();
  elements.videoResultDuration.textContent = `${result.duration || elements.videoDuration.value} 秒`;
  elements.videoResultFooter.hidden = false;
}

function setVideoLoading(isLoading) {
  elements.videoSubmitButton.classList.toggle("is-loading", isLoading);
  elements.videoSubmitButton.disabled = isLoading || !state.videoBackendReady;
  elements.videoSubmitButton.querySelector("span").textContent = isLoading ? "正在生成" : "生成视频";
  elements.videoLoadingState.hidden = !isLoading;

  if (isLoading) {
    elements.resultVideo.pause();
    elements.resultVideo.hidden = true;
    elements.videoEmptyState.hidden = true;
    elements.videoDownloadButton.hidden = true;
    elements.videoResultFooter.hidden = true;
    if (state.activePlatform === "video") setStatus("busy", "正在生成视频");
  } else if (state.lastVideoResult) {
    elements.resultVideo.hidden = false;
    elements.videoEmptyState.hidden = true;
    elements.videoDownloadButton.hidden = false;
    elements.videoResultFooter.hidden = false;
  } else {
    elements.resultVideo.hidden = true;
    elements.videoEmptyState.hidden = false;
  }
}

function showVideoMessage(message, type = "info") {
  elements.videoMessageBox.textContent = message;
  elements.videoMessageBox.classList.toggle("error", type === "error");
  elements.videoMessageBox.hidden = false;
}

function hideVideoMessage() {
  elements.videoMessageBox.hidden = true;
  elements.videoMessageBox.textContent = "";
  elements.videoMessageBox.classList.remove("error");
}

function formatVideoError(status, message) {
  const detail = String(message || "").trim();
  if (status === 401 || status === 403) return `方舟密钥无效或没有视频模型权限。${appendDetail(detail)}`;
  if (status === 429) return `方舟视频服务当前请求较多，请稍后重试。${appendDetail(detail)}`;
  return detail || `视频生成失败（HTTP ${status || 500}）。`;
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
    if (state.activePlatform === "image") setStatus("ready", "图片生成完成");
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? "本次生成已等待超过 10 分 30 秒，连接已结束。"
        : formatGenerateError(error.status, error.message, error.details);
    showMessage(message, "error");
    if (state.activePlatform === "image") setStatus("error", "图片生成失败");
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
    if (state.activePlatform === "image") setStatus("busy", "正在生成图片");
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
    return `后端密钥无效或没有模型权限。${appendDetail(detail)}`;
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
