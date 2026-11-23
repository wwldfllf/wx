import { assertConfigured, getConfig, json } from "../_lib/image-api.js";
import { generateFromFormData } from "../_lib/generate-handler.js";

const HEARTBEAT_MS = 8000;

export async function onRequestPost({ request, env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "无法读取生成表单。" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let cancelled = false;
  let interval;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      send({ type: "start", timeoutMs: config.upstreamTimeoutMs });
      interval = setInterval(() => {
        send({ type: "progress", elapsedMs: Date.now() - startedAt, timeoutMs: config.upstreamTimeoutMs });
      }, HEARTBEAT_MS);
      void generateFromFormData(formData, config)
        .then((result) => send({ type: "done", elapsedMs: Date.now() - startedAt, result }))
        .catch((error) => send({
          type: "error", status: error.status || 500, error: error.message || "生成失败，请稍后再试。", details: error.details
        }))
        .finally(() => {
          clearInterval(interval);
          if (!cancelled) controller.close();
        });
    },
    cancel() {
      cancelled = true;
      clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
