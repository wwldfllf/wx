const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:4173";

const [home, styles, app, referenceHero, capabilities, videoResponse] = await Promise.all([
  readText(`${baseUrl}/`),
  readText(`${baseUrl}/styles.css`),
  readText(`${baseUrl}/app.js`),
  readBytes(`${baseUrl}/assets/reference-dream-gallery.jpg`),
  readJson(`${baseUrl}/api/capabilities`),
  fetch(`${baseUrl}/api/video/capabilities`)
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
    home.includes("从一句构想到一张图") &&
    home.includes("开始创作") &&
    home.includes("电影场景"),
  hasStudioScene: home.includes('id="studioExperience"'),
  hasNoApiKeyInput: !home.includes('id="apiKey"') && !home.includes('name="api_key"'),
  hasPrompt: home.includes('id="prompt"'),
  hasUpload: home.includes('id="imageInput"'),
  hasResultStage: home.includes('id="resultStage"'),
  hasCustomSizeMenu:
    home.includes('id="sizeMenuButton"') &&
    home.includes('id="sizeMenuList"') &&
    app.includes("renderSizeMenu"),
  hasImageOnlyUI: /id="platformSwitch" hidden inert/.test(home) && !app.includes('loadCapabilities(), loadVideoCapabilities()'),
  hasCustomSize: home.includes('id="customDimensions"') && home.includes('id="customWidth"') && home.includes('id="customHeight"'),
  hasThemePicker: (home.match(/data-theme-picker/g) || []).length === 2 && styles.includes('data-theme="dark"'),
  hasStarterCases: (home.match(/data-prompt-preset=/g) || []).length >= 6,
  hasVersionedAssets:
    home.includes("app.js?v=20261123-image26") &&
    home.includes("styles.css?v=20261123-image26") &&
    !home.includes("welcome-scene.js"),
  hasMobileLayout: styles.includes("@media (max-width: 560px)"),
  hasSlowTransitions:
    app.includes("ENTER_TRANSITION_MS = 1550") &&
    app.includes("PLATFORM_TRANSITION_MS = 900") &&
    styles.includes("welcome-curtain 1500ms"),
  usesBackendStream: app.includes('fetch("/api/generate-stream"'),
  hasNoPublicUpstream:
    !app.includes("api.codeyu.shop") &&
    !app.includes("ark.cn-beijing.volces.com") &&
    !app.includes("Authorization"),
  defaultModel: capabilities.defaultModel,
  models: capabilities.models?.map((model) => model.id) || [],
  imageSizes: capabilities.models?.[0]?.sizes || [],
  formats: capabilities.models?.[0]?.formats || [],
  customSize: capabilities.models?.[0]?.customSize || null,
  videoStatus: videoResponse.status
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
  !checks.hasImageOnlyUI || !checks.hasCustomSize || !checks.hasThemePicker || !checks.hasStarterCases
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

if (!checks.usesBackendStream || !checks.hasNoPublicUpstream) {
  throw new Error("前端没有使用安全的后端流式生成通道。");
}

if (checks.videoStatus !== 404) throw new Error("视频 API 未关闭。");
if (!checks.models.includes(checks.defaultModel) || !checks.imageSizes.includes("1536x1024")) {
  throw new Error("图片模型配置无效。");
}
if (!["png", "jpeg", "webp"].every((f) => checks.formats.includes(f))) throw new Error("下载格式不完整。");
if (checks.defaultModel === "gpt-image-2.6" && (!checks.customSize || !checks.imageSizes.includes("1024x768"))) {
  throw new Error("2.6 自定义尺寸或常用比例未开放。");
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
