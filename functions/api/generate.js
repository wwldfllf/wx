import {
  assertConfigured,
  createImage,
  createImageEdit,
  getConfig,
  json,
  normalizeImageResults
} from "../_lib/image-api.js";

export async function onRequestPost({ request, env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  try {
    const formData = await request.formData();
    const prompt = String(formData.get("prompt") || "").trim();
    const model = String(formData.get("model") || config.defaultModel).trim();
    const size = String(formData.get("size") || "auto").trim();
    const quality = String(formData.get("quality") || "auto").trim();
    const outputFormat = String(formData.get("output_format") || "png").trim();
    const image = formData.get("image");

    if (!prompt) {
      return json({ error: "Please enter an image prompt first." }, { status: 400 });
    }

    const hasReferenceImage = image instanceof File && image.size > 0;
    const result = hasReferenceImage
      ? await createImageEdit(config, {
          image,
          model,
          prompt,
          size,
          quality,
          outputFormat
        })
      : await createImage(config, {
          model,
          prompt,
          size,
          quality,
          outputFormat
        });

    const images = normalizeImageResults(result, outputFormat);

    if (!images.length) {
      return json(
        {
          error: "The image API responded but did not return a displayable image.",
          raw: result
        },
        { status: 502 }
      );
    }

    return json({
      images,
      model,
      mode: hasReferenceImage ? "image" : "text",
      created: result.created || Date.now()
    });
  } catch (error) {
    return json(
      {
        error: error.message || "Generation failed. Please try again later.",
        details: error.details
      },
      { status: error.status || 500 }
    );
  }
}
