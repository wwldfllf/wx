import assert from "node:assert/strict";
import test from "node:test";
import { createImage, getConfig } from "../functions/_lib/image-api.js";

const config = getConfig({
  IMAGE_API_BASE_URL: "https://gateway.example",
  IMAGE_API_KEY: "test-only-token",
  IMAGE_MODEL: "gpt-image-2.6"
});
const settings = {
  model: config.defaultModel, prompt: "Test image", size: "1152x832", quality: "medium", outputFormat: "png"
};

test("image fetch uses a redirect mode supported by Cloudflare Workers", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://gateway.example/v1/images/generations");
    assert.equal(init.redirect, "manual");
    assert.equal(init.headers.get("Authorization"), "Bearer test-only-token");
    return Response.json({ data: [{ url: "https://gateway.example/example.png" }] });
  });
  assert.equal((await createImage(config, settings)).data.length, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("image fetch rejects an upstream redirect without following or surfacing its target", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("private redirect response", {
    status: 307, headers: { Location: "https://other.example/private" }
  }));
  await assert.rejects(createImage(config, settings), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.details.upstreamStatus, 307);
    assert.doesNotMatch(JSON.stringify({ message: error.message, details: error.details }), /other\.example|private redirect response/);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});
