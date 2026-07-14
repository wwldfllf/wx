const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:4173";

const [home, styles, app, welcomeScene, three, capabilities] = await Promise.all([
  readText(`${baseUrl}/`),
  readText(`${baseUrl}/styles.css`),
  readText(`${baseUrl}/app.js`),
  readText(`${baseUrl}/welcome-scene.js`),
  readText(`${baseUrl}/vendor/three.module.min.js`),
  readJson(`${baseUrl}/api/capabilities`)
]);

const checks = {
  hasTitle: home.includes("<title>Image Studio</title>"),
  hasWelcomeScene:
    home.includes('id="welcomeExperience"') &&
    home.includes('id="welcomeCanvas"') &&
    home.includes('id="startStudioButton"') &&
    home.includes('id="welcomeQuickForm"') &&
    home.includes('id="welcomeGetStarted"'),
  hasStudioScene: home.includes('id="studioExperience"'),
  hasNoApiKeyInput: !home.includes('id="apiKey"') && !home.includes('name="api_key"'),
  hasPrompt: home.includes('id="prompt"'),
  hasUpload: home.includes('id="imageInput"'),
  hasResultStage: home.includes('id="resultStage"'),
  hasVersionedAssets:
    home.includes("app.js?v=20260714-imagine") &&
    home.includes("styles.css?v=20260714-imagine") &&
    home.includes("welcome-scene.js?v=20260714-imagine"),
  hasMobileLayout: styles.includes("@media (max-width: 560px)"),
  usesLocalThree:
    welcomeScene.includes('from "/vendor/three.module.min.js"') && three.includes("WebGLRenderer"),
  usesBackendStream: app.includes('fetch("/api/generate-stream"'),
  hasNoPublicUpstream: !app.includes("api.codeyu.shop") && !app.includes("Authorization"),
  defaultModel: capabilities.defaultModel,
  models: capabilities.models?.map((model) => model.id) || [],
  image2Sizes: capabilities.models?.find((model) => model.id === "gpt-image-2")?.sizes || []
};

if (
  !checks.hasTitle ||
  !checks.hasWelcomeScene ||
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

if (!checks.usesLocalThree) {
  throw new Error("欢迎页没有使用站内 Three.js 主视觉。");
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

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}
