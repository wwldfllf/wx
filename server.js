import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { onRequestGet as capabilities } from "./functions/api/capabilities.js";
import { onRequestGet as health } from "./functions/api/health.js";
import { onRequestPost as generate } from "./functions/api/generate.js";
import { onRequestPost as generateStream } from "./functions/api/generate-stream.js";
import { onRequest as videoClosed } from "./functions/api/video/_middleware.js";

const app = express();
const staticDir = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 4173);
const env = { ...process.env, IMAGE_API_TRANSPORT: "fetch" };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fields: 10, fileSize: 20 * 1024 * 1024, fieldSize: 32768 }
});

app.disable("x-powered-by");
app.get("/api/health", adapt(health));
app.get("/api/capabilities", adapt(capabilities));
app.use("/api/video", adapt(videoClosed));
app.post("/api/generate", upload.single("image"), adapt(generate));
app.post("/api/generate-stream", upload.single("image"), adapt(generateStream));
app.use(express.static(staticDir));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/") || !req.accepts("html")) return next();
  res.sendFile(path.join(staticDir, "index.html"));
});
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (!(error instanceof multer.MulterError)) return next(error);
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "参考图或表单超出限制。" });
});

app.listen(port, () => console.log(`Image2 Studio is running at http://localhost:${port}`));

function adapt(handler) {
  return async (req, res, next) => {
    let body;
    if (req.method === "POST") {
      body = new FormData();
      for (const [name, value] of Object.entries(req.body || {})) {
        if (typeof value === "string") body.set(name, value);
      }
      if (req.file) {
        body.set("image", new File([req.file.buffer], req.file.originalname, { type: req.file.mimetype }));
      }
    }
    const request = new Request(`http://localhost${req.originalUrl}`, { method: req.method, body });
    try {
      const response = await handler({ request, env });
      res.status(response.status);
      for (const [name, value] of response.headers) res.setHeader(name, value);
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
    } catch (error) {
      if (!res.destroyed) next(error);
    }
  };
}
