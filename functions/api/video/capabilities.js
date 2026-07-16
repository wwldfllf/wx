import { json } from "../../_lib/image-api.js";
import { getVideoConfig, videoCapabilities } from "../../_lib/video-api.js";

export function onRequestGet({ env }) {
  return json(videoCapabilities(getVideoConfig(env)));
}
