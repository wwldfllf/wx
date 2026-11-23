import assert from "node:assert/strict";
import { test } from "node:test";
import { createModelCapabilities, parseImageSettings } from "../functions/_lib/image-profile.js";
import { resolutionPresets } from "../public/image-dimensions.js";

const model = createModelCapabilities("gpt-image-2.6");

test("every aspect ratio has three increasing, server-valid pixel sizes at the exact aspect ratio", () => {
  for (const aspect of model.sizes) {
    const [aw, ah] = aspect.split("x").map(Number);
    const sizes = resolutionPresets(aspect, model.customSize);
    assert.equal(sizes.length, 3, aspect);
    let area = 0;
    for (const size of sizes) {
      const [w, h] = size.split("x").map(Number);
      assert.equal(w * ah, h * aw, `${size} ${aspect}`);
      assert.ok(w * h > area, size);
      area = w * h;
      const form = new FormData();
      form.set("prompt", "Glass corridor");
      form.set("size", size);
      assert.equal(parseImageSettings(form, model.id).size, size);
    }
  }
  assert.deepEqual(resolutionPresets("custom", model.customSize), []);
  assert.deepEqual(resolutionPresets("1024x1024", null), []);
});
