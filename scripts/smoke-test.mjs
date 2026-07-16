const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:4173";

const [home, styles, app, referenceHero, capabilities, videoCapabilities] = await Promise.all([
  readText(`${baseUrl}/`),
  readText(`${baseUrl}/styles.css`),
  readText(`${baseUrl}/app.js`),
  readBytes(`${baseUrl}/assets/reference-dream-gallery.jpg`),
  readJson(`${baseUrl}/api/capabilities`),
  readJson(`${baseUrl}/api/video/capabilities`)
]);

const checks = {
  hasTitle: home.includes("<title>灵感画室</title>"),
  hasWelcomeScene:
    home.includes('id="welcomeExperience"') &&
    home.includes('id="startStudioButton"') &&
    home.includes('class="welcome-reference-art"'),
  hasReferenceHero: referenceHero.byteLength > 50000,
  hasWelcomePages:
    ["Home", "Explore", "Gallery", "Pricing", "About"].every((name) =>
      home.includes(`id="welcomePage${name}"`)
    ) &&
    (home.match(/class="gallery-item/g) || []).length >= 6,
  hasNoTopStartButton:
    !home.includes('id="welcomeGetStarted"') && !home.includes('id="welcomeCanvas"'),
  hasNoWelcomeDialog:
    !home.includes('id="welcomeQuickForm"') && !home.includes('id="welcomePrompt"'),
  hasChineseWelcome:
    home.includes("让每一种想象") &&
    home.includes("开始创作") &&
    home.includes("智能创作引擎"),
  hasStudioScene: home.includes('id="studioExperience"'),
  hasNoApiKeyInput: !home.includes('id="apiKey"') && !home.includes('name="api_key"'),
  hasPrompt: home.includes('id="prompt"'),
  hasUpload: home.includes('id="imageInput"'),
  hasResultStage: home.includes('id="resultStage"'),
  hasCustomSizeMenu:
    home.includes('id="sizeMenuButton"') &&
    home.includes('id="sizeMenuList"') &&
    app.includes("renderSizeMenu"),
  hasVideoWorkspace:
    home.includes('id="videoPlatformPane"') &&
    home.includes('id="videoGenerateForm"') &&
    home.includes('id="resultVideo"') &&
    home.includes('id="videoSubmitButton"'),
  hasVersionedAssets:
    home.includes("app.js?v=20260715-video-workspace") &&
    home.includes("styles.css?v=20260715-video-workspace") &&
    !home.includes("welcome-scene.js"),
  hasMobileLayout: styles.includes("@media (max-width: 560px)"),
  hasSlowTransitions:
    app.includes("ENTER_TRANSITION_MS = 1550") &&
    app.includes("PLATFORM_TRANSITION_MS = 900") &&
    styles.includes("welcome-curtain 1500ms"),
  usesBackendStream: app.includes('fetch("/api/generate-stream"'),
  usesVideoBackend:
    app.includes('fetch("/api/video/generate"') && app.includes("/api/video/tasks/"),
  hasNoPublicUpstream:
    !app.includes("api.codeyu.shop") &&
    !app.includes("ark.cn-beijing.volces.com") &&
    !app.includes("Authorization"),
  defaultModel: capabilities.defaultModel,
  models: capabilities.models?.map((model) => model.id) || [],
  image2Sizes: capabilities.models?.find((model) => model.id === "gpt-image-2")?.sizes || [],
  videoModel: videoCapabilities.model?.id || "",
  videoConfigured: Boolean(videoCapabilities.configured),
  videoResolutions: videoCapabilities.resolutions || []
};

if (
  !checks.hasTitle ||
  !checks.hasWelcomeScene ||
  !checks.hasReferenceHero ||
  !checks.hasWelcomePages ||
  !checks.hasNoTopStartButton ||
  !checks.hasNoWelcomeDialog ||
  !checks.hasChineseWelcome ||
  !checks.hasStudioScene ||
  !checks.hasNoApiKeyInput ||
  !checks.hasPrompt ||
  !checks.hasUpload ||
  !checks.hasResultStage ||
  !checks.hasCustomSizeMenu ||
  !checks.hasVideoWorkspace
) {
  throw new Error("首页缺少关键 UI 节点。");
}

if (!checks.hasVersionedAssets) {
  throw new Error("首页没有使用带版本号的 JS/CSS 资源。");
}

if (!checks.hasMobileLayout) {
  throw new Error("样式缺少移动端布局。");
}

if (!checks.hasSlowTransitions) {
  throw new Error("欢迎页或平台切换动画时序没有更新。");
}

if (!checks.usesBackendStream || !checks.usesVideoBackend || !checks.hasNoPublicUpstream) {
  throw new Error("前端没有使用安全的后端流式生成通道。");
}

if (!checks.videoModel.includes("seedance-2-0-mini")) {
  throw new Error("视频能力探测没有返回 Seedance 2.0 Mini。");
}

if (!checks.videoResolutions.includes("480p") || !checks.videoResolutions.includes("720p")) {
  throw new Error("视频能力探测缺少 mini 支持的清晰度。");
}

if (!checks.models.includes("gpt-image-2")) {
  throw new Error("能力探测没有返回 gpt-image-2。");
}

if (!checks.image2Sizes.includes("1536x1024") || checks.image2Sizes.includes("auto")) {
  throw new Error("gpt-image-2 尺寸选项没有按网关教程配置。");
}

console.log(JSON.stringify(checks, null, 2));

async function readText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function readBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.arrayBuffer();
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}
