export async function exportImage(src, format) {
  const mime = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" }[format];
  if (!mime) throw new Error("不支持所选下载格式。");
  const response = await fetch(src, { credentials: "omit" });
  if (!response.ok) throw new Error("读取源图失败。");
  const source = await response.blob();
  const image = await createImageBitmap(source);
  try {
    if (source.type === mime) return source;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不能转换图片。");
    if (format === "jpeg") {
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);
    const output = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.95));
    if (output?.type !== mime) throw new Error("浏览器未能编码所选格式。");
    return output;
  } finally {
    image.close();
  }
}
