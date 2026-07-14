const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:4173";

const [home, styles, app, referenceHero, capabilities] = await Promise.all([
  readText(`${baseUrl}/`),
  readText(`${baseUrl}/styles.css`),
  readText(`${baseUrl}/app.js`),
  readBytes(`${baseUrl}/assets/reference-dream-gallery.jpg`),
  readJson(`${baseUrl}/api/capabilities`)
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
  hasVersionedAssets:
    home.includes("app.js?v=20260714-welcome-pages") &&
    home.includes("styles.css?v=20260714-welcome-pages") &&
    !home.includes("welcome-scene.js"),
  hasMobileLayout: styles.includes("@media (max-width: 560px)"),
  usesBackendStream: app.includes('fetch("/api/generate-stream"'),
  hasNoPublicUpstream: !app.includes("api.codeyu.shop") && !app.includes("Authorization"),
  defaultModel: capabilities.defaultModel,
  models: capabilities.models?.map((model) => model.id) || [],
  image2Sizes: capabilities.models?.find((model) => model.id === "gpt-image-2")?.sizes || []
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
  !checks.hasResultStage
) {
  throw new Error("首页缺少关键 UI 节点。");
}

if (!checks.hasVersionedAssets) {
  throw new Error("首页没有使用带版本号的 JS/CSS 资源。");
}

if (!checks.hasMobileLayout) {
  throw new Error("样式缺少移动端布局。");
}

if (!checks.usesBackendStream || !checks.hasNoPublicUpstream) {
  throw new Error("前端没有使用安全的后端流式生成通道。");
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
