import argparse
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


DEFAULT_BASE_URL = "https://api.kkk1eran.top"
DEFAULT_MODEL = "gpt-image-2"
ALLOWED_SIZES = {"1024x1024", "1536x1024", "1024x1536"}


def main():
    parser = argparse.ArgumentParser(description="Call the kkk1eran GPT Image 2 gateway.")
    parser.add_argument("--prompt", required=True, help="Image prompt.")
    parser.add_argument("--size", default="1024x1024", choices=sorted(ALLOWED_SIZES), help="Output size.")
    parser.add_argument("--image", action="append", default=[], help="Reference image path. Repeat for multiple images.")
    parser.add_argument("--base-url", default=get_env("IMAGE_API_BASE_URL") or DEFAULT_BASE_URL)
    parser.add_argument("--model", default=get_env("IMAGE_MODEL") or DEFAULT_MODEL)
    parser.add_argument("--out-dir", default="generated")
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    api_key = get_env("IMAGE_API_KEY") or get_env("API_KEY")
    if not api_key:
        raise SystemExit("Missing IMAGE_API_KEY or API_KEY. Set it in the environment or .env.")

    base_url = normalize_base_url(args.base_url)
    if args.image:
        result = edit_image(base_url, api_key, args.model, args.prompt, args.size, args.image, args.timeout)
        prefix = "edited"
    else:
        result = generate_image(base_url, api_key, args.model, args.prompt, args.size, args.timeout)
        prefix = "generated"

    saved = save_first_image(result, Path(args.out_dir), prefix)
    print(json.dumps({"saved": str(saved) if saved else None, "response_keys": list(result.keys())}, ensure_ascii=False, indent=2))


def get_env(name):
    value = os.environ.get(name)
    if value:
        return value

    env_path = Path(".env")
    if not env_path.exists():
        return None

    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        if key.strip() == name:
            return raw_value.strip().strip('"').strip("'")

    return None


def generate_image(base_url, api_key, model, prompt, size, timeout):
    payload = {
        "model": model,
        "prompt": prompt,
        "size": normalize_size(size),
    }
    return post_json(f"{base_url}/v1/images/generations", api_key, payload, timeout)


def edit_image(base_url, api_key, model, prompt, size, image_paths, timeout):
    fields = {
        "model": model,
        "prompt": prompt,
        "size": normalize_size(size),
    }
    files = []
    for image_path in image_paths:
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image does not exist: {path}")
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        files.append(("image[]", path.name, mime_type, path.read_bytes()))

    body, content_type = encode_multipart(fields, files)
    request = urllib.request.Request(
        f"{base_url}/v1/images/edits",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": content_type,
        },
        method="POST",
    )
    return send_request(request, timeout)


def normalize_size(size):
    return size if size in ALLOWED_SIZES else "1024x1024"


def normalize_base_url(value):
    trimmed = value.rstrip("/")
    if trimmed.lower().endswith("/v1"):
        return trimmed[:-3]
    return trimmed


def post_json(url, api_key, payload, timeout):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return send_request(request, timeout)


def send_request(request, timeout):
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            text = response.read().decode("utf-8", errors="replace")
            print("status:", response.status)
            print("text:", text[:1000])
            return json.loads(text)
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", errors="replace")
        print("status:", error.code)
        print("text:", text[:1000])
        raise


def encode_multipart(fields, files):
    boundary = f"----image2studio{uuid.uuid4().hex}"
    chunks = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                str(value).encode(),
                b"\r\n",
            ]
        )

    for name, filename, mime_type, data in files:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode(),
                f"Content-Type: {mime_type}\r\n\r\n".encode(),
                data,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def save_first_image(result, out_dir, prefix):
    data = result.get("data") or []
    if not data:
        return None

    item = data[0]
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")

    if item.get("b64_json"):
        output = out_dir / f"{prefix}-{timestamp}.png"
        output.write_bytes(base64.b64decode(item["b64_json"]))
        return output

    if item.get("url"):
        output = out_dir / f"{prefix}-{timestamp}.png"
        with urllib.request.urlopen(item["url"], timeout=300) as response:
            output.write_bytes(response.read())
        return output

    return None


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"error: {error}", file=sys.stderr)
        raise
