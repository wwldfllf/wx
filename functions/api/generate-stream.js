import { assertConfigured, getConfig } from "../_lib/image-api.js";
import { generateFromFormData } from "../_lib/generate-handler.js";

const HEARTBEAT_MS = 10000;

export async function onRequestPost({ request, env }) {
  const config = getConfig(env);
  const configError = assertConfigured(config);
  if (configError) return configError;

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Could not read generation request." }), {
      status: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const startedAt = Date.now();

      send({
        type: "start",
        message: "Image generation started.",
        timeoutMs: config.upstreamTimeoutMs
      });

      const generation = generateFromFormData(formData, config);
      try {
        let result;
        while (!cancelled) {
          const tick = sleep(HEARTBEAT_MS).then(() => ({ type: "tick" }));
          const completed = generation.then((value) => ({ type: "done", value }));
          const next = await Promise.race([completed, tick]);

          if (next.type === "done") {
            result = next.value;
            break;
          }

          send({
            type: "progress",
            elapsedMs: Date.now() - startedAt,
            timeoutMs: config.upstreamTimeoutMs
          });
        }

        if (cancelled) return;

        send({
          type: "done",
          elapsedMs: Date.now() - startedAt,
          result
        });
      } catch (error) {
        send({
          type: "error",
          status: error.status || 500,
          error: error.message || "Generation failed. Please try again later.",
          details: error.details
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
