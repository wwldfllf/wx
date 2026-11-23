export function onRequest() {
  return Response.json({ error: "视频生成暂未开放。" }, {
    status: 404,
    headers: { "Cache-Control": "no-store" }
  });
}
