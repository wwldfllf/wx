const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:4173";

const [home, styles, capabilities] = await Promise.all([
  readText(`${baseUrl}/`),
  readText(`${baseUrl}/styles.css`),
  readJson(`${baseUrl}/api/capabilities`)
]);

const checks = {
  hasTitle: home.includes("<title>Image2 Studio</title>"),
  hasPrompt: home.includes('id="prompt"'),
  hasUpload: home.includes('id="imageInput"'),
  hasResultStage: home.includes('id="resultStage"'),
  hasMobileLayout: styles.includes("@media (max-width: 840px)"),
  defaultModel: capabilities.defaultModel,
  models: capabilities.models?.map((model) => model.id) || []
};

if (!checks.hasTitle || !checks.hasPrompt || !checks.hasUpload || !checks.hasResultStage) {
  throw new Error("首页缺少关键 UI 节点。");
}

if (!checks.hasMobileLayout) {
  throw new Error("样式缺少移动端布局。");
}

if (!checks.models.includes("gpt-image-2")) {
  throw new Error("能力探测没有返回 gpt-image-2。");
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
