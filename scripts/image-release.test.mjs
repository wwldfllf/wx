import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { Server } from "node:net";
import { test } from "node:test";

const captured = [];
const fixture = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=";
const address = (server) => `http://127.0.0.1:${server.address().port}`;
const form = (fields) => {
  const body = new FormData();
  for (const [name, value] of Object.entries({ prompt: "A glass sculpture", ...fields })) {
    body.set(name, value);
  }
  return body;
};

test("image release preserves parameters and preview formats, and keeps video closed", async () => {
  const upstream = http.createServer(async (req, res) => {
    const request = new Request(address(upstream) + req.url, {
      method: req.method, headers: req.headers, body: req, duplex: "half"
    });
    const body = req.url.endsWith("/edits")
      ? Object.fromEntries(await request.formData()) : await request.json();
    captured.push({ path: req.url, body, authorization: req.headers.authorization });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: fixture }] }));
  });
  await once(upstream.listen(0, "127.0.0.1"), "listening");
  Object.assign(process.env, {
    IMAGE_API_BASE_URL: address(upstream), IMAGE_API_KEY: "local-test-token",
    IMAGE_API_TRANSPORT: "fetch", IMAGE_MODEL: "gpt-image-2.6", ARK_API_KEY: "not-enabled"
  });
  const originalListen = Server.prototype.listen;
  let studio;
  let ready;
  Server.prototype.listen = function (_port, callback) {
    studio = this;
    ready = once(studio, "listening");
    return originalListen.call(this, 0, "127.0.0.1", callback);
  };
  try {
    await import("../server.js");
    await ready;
    const base = address(studio);
    const caps = await (await fetch(base + "/api/capabilities")).json();
    assert.equal(caps.defaultModel, "gpt-image-2.6");
    assert.ok(caps.models[0].customSize);
    assert.ok(caps.models[0].qualities.includes("medium"));
    assert.ok(caps.models[0].formats.includes("webp"));
    for (const [path, method] of [["capabilities", "GET"], ["generate", "POST"], ["tasks/123", "GET"]]) {
      assert.equal((await fetch(base + "/api/video/" + path, { method })).status, 404);
    }
    const rejected = await fetch(base + "/api/generate", { method: "POST", body: form({ size: "123x456" }) });
    assert.equal(rejected.status, 400);
    assert.equal(captured.length, 0);

    const chosen = { size: "1024x768", quality: "medium", output_format: "webp" };
    const generated = await fetch(base + "/api/generate", { method: "POST", body: form(chosen) });
    assert.equal(generated.status, 200);
    const result = await generated.json();
    assert.equal(result.model, caps.defaultModel);
    assert.equal(result.size, chosen.size);
    assert.equal(result.images[0].mimeType, "image/png");
    assert.match(result.images[0].src, /^data:image\/png;base64,/);
    assert.equal(captured[0].path, "/v1/images/generations");
    assert.equal(captured[0].authorization, "Bearer local-test-token");
    for (const [key, val] of Object.entries(chosen)) assert.equal(captured[0].body[key], val);
    const image = new File([Buffer.from(fixture, "base64")], "reference.png", { type: "image/png" });
    const edited = await fetch(base + "/api/generate-stream", { method: "POST", body: form({ ...chosen, image }) });
    assert.equal(edited.status, 200);
    const events = (await edited.text()).trim().split("\n").map(JSON.parse);
    assert.equal(events.at(-1).type, "done");
    assert.equal(events.at(-1).result.mode, "image");
    assert.equal(captured[1].path, "/v1/images/edits");
    assert.equal(captured[1].body["image[]"].name, "reference.png");
    for (const [key, val] of Object.entries(chosen)) assert.equal(captured[1].body[key], val);
  } finally {
    Server.prototype.listen = originalListen;
    await Promise.all([studio, upstream].filter(Boolean).map((server) => new Promise((resolve) => server.close(resolve))));
  }
});
