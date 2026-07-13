import { connect } from "cloudflare:sockets";

export const IMAGE2_MODEL = "gpt-image-2";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 300000;
const MAX_SOCKET_RESPONSE_BYTES = 50 * 1024 * 1024;

export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {})
    }
  });
}

export function getConfig(env) {
  const apiBaseUrl = normalizeBaseUrl(env.IMAGE_API_BASE_URL);

  return {
    apiBaseUrl,
    apiKey: env.IMAGE_API_KEY || "",
    defaultModel: IMAGE2_MODEL,
    configuredModel: env.IMAGE_MODEL || "",
    configuredUpstreamTimeoutMs: env.IMAGE_UPSTREAM_TIMEOUT_MS || "",
    upstreamTimeoutMs: parseTimeoutMs(env.IMAGE_UPSTREAM_TIMEOUT_MS),
    configuredTransport: env.IMAGE_API_TRANSPORT || "",
    apiTransport: resolveApiTransport(apiBaseUrl, env.IMAGE_API_TRANSPORT)
  };
}

export function assertConfigured(config) {
  if (!config.apiBaseUrl || !config.apiKey) {
    return json(
      {
        error: "Cloudflare environment variables IMAGE_API_BASE_URL or IMAGE_API_KEY are not configured."
      },
      { status: 500 }
    );
  }

  return null;
}

export function fallbackCapabilities(defaultModel) {
  return {
    models: [createModelCapabilities(defaultModel)],
    defaultModel,
    source: "fallback"
  };
}

export async function fetchModels(config) {
  const response = await apiFetch(config, "/v1/models", {
    method: "GET"
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw createApiError(response, body, "Could not detect model list from upstream API.");
  }

  return Array.isArray(body.data) ? body.data : [];
}

export function isLikelyImageModel(modelId) {
  const id = String(modelId || "").toLowerCase();
  return (
    id.includes("image") ||
    id.includes("dall") ||
    id.includes("flux") ||
    id.includes("sd") ||
    id.includes("midjourney")
  );
}

export function createModelCapabilities(id) {
  const lower = String(id || "").toLowerCase();
  const isGptImage = lower.includes("gpt-image");
  const isGptImage2 = lower.includes("gpt-image-2");

  if (isGptImage2) {
    return {
      id,
      label: id,
      sizes: ["1024x1024", "1536x1024", "1024x1536"],
      qualities: ["gateway-default"],
      formats: ["png"],
      modes: ["text", "image"]
    };
  }

  if (isGptImage) {
    return {
      id,
      label: id,
      sizes: ["1024x1024", "1024x1536", "1536x1024", "auto"],
      qualities: ["auto", "low", "medium", "high"],
      formats: ["png", "jpeg", "webp"],
      modes: ["text", "image"]
    };
  }

  return {
    id,
    label: id,
    sizes: ["1024x1024", "1024x1792", "1792x1024", "auto"],
    qualities: ["standard", "hd", "auto"],
    formats: ["png", "jpeg", "webp"],
    modes: ["text", "image"]
  };
}

export async function createImage(config, { model, prompt, size, quality, outputFormat }) {
  const payload = isGptImage2Model(model)
    ? compactObject({
        model,
        prompt,
        size: normalizeGptImage2Size(size)
      })
    : compactObject({
        model,
        prompt,
        size,
        quality,
        output_format: outputFormat,
        n: 1
      });

  if (!isGptImageModel(model)) {
    payload.response_format = "b64_json";
  }

  const response = await apiFetch(config, "/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Text-to-image request failed.");
  }

  return body;
}

export async function createImageEdit(config, { image, model, prompt, size, quality, outputFormat }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", isGptImage2Model(model) ? normalizeGptImage2Size(size) : size);

  if (!isGptImage2Model(model)) {
    appendOptionalFormValue(form, "quality", quality);
    appendOptionalFormValue(form, "output_format", outputFormat);
  }

  form.append(isGptImage2Model(model) ? "image[]" : "image", image, image.name || "reference.png");

  const response = await apiFetch(config, "/v1/images/edits", {
    method: "POST",
    body: form
  });

  const body = await readJson(response);
  if (!response.ok) {
    throw createApiError(response, body, "Image-plus-text request failed.");
  }

  return body;
}

export function normalizeImageResults(result, requestedFormat) {
  const data = Array.isArray(result?.data) ? result.data : [];
  const images = [];

  for (const item of data) {
    if (!item) continue;

    if (item.b64_json) {
      images.push({
        src: toDataUrl(item.b64_json, item.output_format || requestedFormat),
        mimeType: mimeTypeFor(item.output_format || requestedFormat),
        revisedPrompt: item.revised_prompt || ""
      });
      continue;
    }

    if (item.url) {
      images.push({
        src: item.url,
        mimeType: mimeTypeFor(requestedFormat),
        revisedPrompt: item.revised_prompt || ""
      });
      continue;
    }

    if (typeof item === "string") {
      images.push({
        src: item.startsWith("data:") ? item : toDataUrl(item, requestedFormat),
        mimeType: mimeTypeFor(requestedFormat),
        revisedPrompt: ""
      });
    }
  }

  if (result?.b64_json) {
    images.push({
      src: toDataUrl(result.b64_json, requestedFormat),
      mimeType: mimeTypeFor(requestedFormat),
      revisedPrompt: result.revised_prompt || ""
    });
  }

  if (result?.url) {
    images.push({
      src: result.url,
      mimeType: mimeTypeFor(requestedFormat),
      revisedPrompt: result.revised_prompt || ""
    });
  }

  return images;
}

function normalizeBaseUrl(value) {
  if (!value) return "";
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.replace(/\/v1$/i, "");
}

function resolveApiTransport(apiBaseUrl, configuredTransport) {
  const configured = String(configuredTransport || "").trim().toLowerCase();
  if (configured === "socket" || configured === "tcp-socket") return "socket";
  if (configured === "fetch") return "fetch";

  try {
    return new URL(apiBaseUrl).hostname === "api.codeyu.shop" ? "socket" : "fetch";
  } catch {
    return "fetch";
  }
}

function parseTimeoutMs(value) {
  const parsed = Number(value || DEFAULT_UPSTREAM_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed < DEFAULT_UPSTREAM_TIMEOUT_MS) {
    return DEFAULT_UPSTREAM_TIMEOUT_MS;
  }

  return Math.min(parsed, 900000);
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([_key, value]) => value !== undefined && value !== null && value !== "")
  );
}

function appendOptionalFormValue(form, key, value) {
  if (value) {
    form.append(key, value);
  }
}

function isGptImageModel(model) {
  return String(model || "")
    .toLowerCase()
    .includes("gpt-image");
}

function isGptImage2Model(model) {
  return String(model || "")
    .toLowerCase()
    .includes("gpt-image-2");
}

function normalizeGptImage2Size(size) {
  const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536"]);
  return allowedSizes.has(size) ? size : "1024x1024";
}

async function apiFetch(config, endpoint, options) {
  const timeoutMs = config.upstreamTimeoutMs || DEFAULT_UPSTREAM_TIMEOUT_MS;
  const startedAt = Date.now();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${config.apiKey}`);
  const requestOptions = {
    ...options,
    headers
  };

  if (config.apiTransport === "socket") {
    return apiSocketFetch(config, endpoint, requestOptions, startedAt, timeoutMs);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
      ...requestOptions,
      signal: controller.signal,
      headers
    });
    response.image2Studio = {
      endpoint,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      transport: "fetch"
    };
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("网站后端已按 5 分钟等待，但上游图片接口仍未返回结果。");
      timeoutError.status = 504;
      timeoutError.details = {
        endpoint,
        elapsedMs: Date.now() - startedAt,
        timeoutMs,
        transport: "fetch"
      };
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function apiSocketFetch(config, endpoint, options, startedAt, timeoutMs) {
  const url = new URL(`${config.apiBaseUrl}${endpoint}`);
  if (url.protocol !== "https:") {
    throw new Error("TCP socket image transport requires an HTTPS API endpoint.");
  }

  let socket;
  let timeoutId;
  const operation = (async () => {
    const headers = new Headers(options.headers || {});
    const body = await serializeSocketBody(options.body, headers);
    const request = buildHttpRequest(url, options.method || "GET", headers, body);

    socket = connect(
      {
        hostname: url.hostname,
        port: Number(url.port || 443)
      },
      {
        secureTransport: "on",
        allowHalfOpen: false
      }
    );

    await socket.opened;
    const writer = socket.writable.getWriter();
    await writer.write(request);
    await writer.close();

    const responseBytes = await readSocketBytes(socket.readable);
    return parseHttpResponse(responseBytes);
  })();

  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      socket?.close().catch(() => {});
      const error = new Error("网站后端已按 5 分钟等待，但直连图片接口仍未返回结果。");
      error.name = "SocketTimeoutError";
      reject(error);
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([operation, timeout]);
    response.image2Studio = {
      endpoint,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      transport: "tcp-socket"
    };
    return response;
  } catch (error) {
    if (error.name === "SocketTimeoutError") {
      error.status = 504;
      error.details = {
        endpoint,
        elapsedMs: Date.now() - startedAt,
        timeoutMs,
        transport: "tcp-socket"
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    await socket?.close().catch(() => {});
  }
}

async function serializeSocketBody(body, headers) {
  if (body === undefined || body === null) {
    return new Uint8Array();
  }

  if (typeof body === "string") {
    return new TextEncoder().encode(body);
  }

  if (body instanceof FormData) {
    const serialized = new Response(body);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", serialized.headers.get("Content-Type"));
    }
    return new Uint8Array(await serialized.arrayBuffer());
  }

  if (body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }

  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  throw new TypeError("Unsupported request body for TCP socket image transport.");
}

function buildHttpRequest(url, method, headers, body) {
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("User-Agent")) headers.set("User-Agent", "Image2Studio/1.0");

  const path = `${url.pathname || "/"}${url.search}`;
  const lines = [
    `${String(method).toUpperCase()} ${path} HTTP/1.1`,
    `Host: ${url.host}`,
    "Connection: close",
    `Content-Length: ${body.byteLength}`
  ];

  for (const [name, value] of headers.entries()) {
    const lower = name.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") continue;
    lines.push(`${name}: ${sanitizeHeaderValue(value)}`);
  }

  const head = new TextEncoder().encode(`${lines.join("\r\n")}\r\n\r\n`);
  return concatBytes([head, body]);
}

async function readSocketBytes(readable) {
  const reader = readable.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    total += value.byteLength;
    if (total > MAX_SOCKET_RESPONSE_BYTES) {
      throw new Error("Direct image API response exceeded the 50 MB safety limit.");
    }
    chunks.push(value);
  }

  return concatBytes(chunks, total);
}

function parseHttpResponse(bytes) {
  const separator = new Uint8Array([13, 10, 13, 10]);
  const headerEnd = indexOfBytes(bytes, separator);
  if (headerEnd < 0) {
    throw new Error("Direct image API returned an invalid HTTP response.");
  }

  const head = new TextDecoder().decode(bytes.subarray(0, headerEnd));
  const lines = head.split("\r\n");
  const statusMatch = lines.shift()?.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s+(.*))?$/i);
  if (!statusMatch) {
    throw new Error("Direct image API returned an invalid HTTP status line.");
  }

  const headers = new Headers();
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }

  let body = bytes.subarray(headerEnd + separator.byteLength);
  if (headers.get("Transfer-Encoding")?.toLowerCase().includes("chunked")) {
    body = decodeChunkedBody(body);
    headers.delete("Transfer-Encoding");
    headers.set("Content-Length", String(body.byteLength));
  } else {
    const contentLength = Number(headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength >= 0 && body.byteLength > contentLength) {
      body = body.subarray(0, contentLength);
    }
  }

  return new Response(body, {
    status: Number(statusMatch[1]),
    statusText: statusMatch[2] || "",
    headers
  });
}

function decodeChunkedBody(bytes) {
  const chunks = [];
  let total = 0;
  let offset = 0;

  while (offset < bytes.byteLength) {
    const lineEnd = indexOfBytes(bytes, new Uint8Array([13, 10]), offset);
    if (lineEnd < 0) throw new Error("Invalid chunked HTTP response.");

    const sizeText = new TextDecoder()
      .decode(bytes.subarray(offset, lineEnd))
      .split(";", 1)[0]
      .trim();
    const size = Number.parseInt(sizeText, 16);
    if (!Number.isFinite(size)) throw new Error("Invalid HTTP chunk size.");
    if (size === 0) break;

    const start = lineEnd + 2;
    const end = start + size;
    if (end > bytes.byteLength) throw new Error("Incomplete chunked HTTP response.");

    chunks.push(bytes.subarray(start, end));
    total += size;
    offset = end + 2;
  }

  return concatBytes(chunks, total);
}

function concatBytes(chunks, knownTotal) {
  const total =
    knownTotal ??
    chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function indexOfBytes(bytes, needle, start = 0) {
  outer: for (let index = start; index <= bytes.byteLength - needle.byteLength; index += 1) {
    for (let offset = 0; offset < needle.byteLength; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return index;
  }

  return -1;
}

function sanitizeHeaderValue(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function createApiError(response, body, fallbackMessage) {
  const message =
    response.status === 502
      ? "上游图片接口返回 502，通常是 API 网关或模型服务暂时不可用。"
      : response.status === 504
        ? "上游图片接口返回 504，生成请求被上游提前结束。"
        : body?.error?.message ||
          body?.message ||
          body?.error ||
          body?.text ||
          fallbackMessage;

  const error = new Error(String(message));
  error.status = response.status >= 400 && response.status < 600 ? response.status : 500;
  error.details = {
    ...summarizeErrorDetails(body),
    ...(response.image2Studio || {})
  };
  return error;
}

function summarizeErrorDetails(body) {
  if (!body) return undefined;

  if (typeof body.text === "string") {
    return {
      text: body.text.replace(/\s+/g, " ").trim().slice(0, 240)
    };
  }

  return body;
}

function toDataUrl(value, format) {
  if (value.startsWith("data:")) return value;
  return `data:${mimeTypeFor(format)};base64,${value}`;
}

function mimeTypeFor(format) {
  const normalized = String(format || "png").replace("jpg", "jpeg").toLowerCase();
  if (normalized === "webp") return "image/webp";
  if (normalized === "jpeg") return "image/jpeg";
  return "image/png";
}
