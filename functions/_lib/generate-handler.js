import {
  IMAGE2_MODEL,
  createImage,
  createImageEdit,
  normalizeImageResults
} from "./image-api.js";

export async function generateFromRequest(request, config) {
  const formData = await request.formData();
  return generateFromFormData(formData, config);
}

export async function generateFromFormData(formData, config) {
  const prompt = String(formData.get("prompt") || "").trim();
  const size = String(formData.get("size") || "1024x1024").trim();
  const outputFormat = "png";
  const image = formData.get("image");

  if (!prompt) {
    const error = new Error("Please enter an image prompt first.");
    error.status = 400;
    throw error;
  }

  const hasReferenceImage = image instanceof File && image.size > 0;
  const result = hasReferenceImage
    ? await createImageEdit(config, {
        image,
        model: IMAGE2_MODEL,
        prompt,
        size,
        outputFormat
      })
    : await createImage(config, {
        model: IMAGE2_MODEL,
        prompt,
        size,
        outputFormat
      });

  const images = normalizeImageResults(result, outputFormat);

  if (!images.length) {
    const error = new Error("The image API responded but did not return a displayable image.");
    error.status = 502;
    error.details = result;
    throw error;
  }

  return {
    images,
    model: IMAGE2_MODEL,
    mode: hasReferenceImage ? "image" : "text",
    created: result.created || Date.now()
  };
}
