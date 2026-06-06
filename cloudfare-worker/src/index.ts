/**
MP3 Frame Trimmer Worker for Cloudflare Workers + R2

Example request:
  /trim?key=audio/example.mp3&offset=30&duration=15

Returns:
  audio/mpeg
 */

import { badRequest, looksLikeNextFrame, parseFrameHeader, parseNonNegativeNumber, parsePositiveNumber } from "./utils/audio-trim";
import { skipID3v2Tag } from "./utils/audio-trim";
import { getAudioEnd } from "./utils/audio-trim";

const DEFAULT_MAX_MP3_BYTES = 10 * 1024 * 1024; // 10 MB

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", {
          status: 405,
          headers: {
            Allow: "GET, HEAD",
          },
        });
      }
  
      const url = new URL(request.url);
  
      const key = url.searchParams.get("key");
      if (!key) {
        return badRequest('Missing "key" query parameter');
      }
  
      const offset = parseNonNegativeNumber(url.searchParams.get("offset") ?? "0");
      if (offset === null) {
        return badRequest('"offset" must be a non-negative number');
      }
  
      const durationParam = url.searchParams.get("duration");
      const duration =
        durationParam === null ? null : parsePositiveNumber(durationParam);
  
      if (durationParam !== null && duration === null) {
        return badRequest('"duration" must be a positive number');
      }
  
      const object = await env.R2_BUCKET?.get(key);
  
      if (!object) {
        return new Response("File not found in R2", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }
  
      const maxBytes = Number(env.MAX_MP3_BYTES ?? DEFAULT_MAX_MP3_BYTES);
  
      if (object.size > maxBytes) {
        return new Response("MP3 too large for in-memory trimming", {
          status: 413,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      }
  
      const bytes = new Uint8Array(await object.arrayBuffer());
  
      const audioStart = skipID3v2Tag(bytes);
      const audioEnd = getAudioEnd(bytes);
  
      if (audioStart >= audioEnd) {
        return badRequest("No MP3 audio data found");
      }
  
      let pos = audioStart;
      let currentTime = 0;
  
      let startByte = -1;
      let endByte = -1;
  
      const targetEnd = duration === null ? null : offset + duration;
  
      while (pos + 4 <= audioEnd) {
        const frame = parseFrameHeader(bytes[pos], bytes[pos + 1], bytes[pos + 2]);
  
        if (
          !frame ||
          pos + frame.frameSize > audioEnd ||
          !looksLikeNextFrame(bytes, pos, frame.frameSize, audioEnd)
        ) {
          // Not a valid frame at this position. Move forward and try to resync.
          pos++;
          continue;
        }
  
        const nextTime = currentTime + frame.duration;
  
        if (startByte === -1 && nextTime > offset) {
          startByte = pos;
        }
  
        if (targetEnd !== null && startByte !== -1 && nextTime >= targetEnd) {
          endByte = pos + frame.frameSize;
          break;
        }
  
        currentTime = nextTime;
        pos += frame.frameSize;
      }
  
      if (startByte === -1) {
        return badRequest("Offset exceeds audio duration");
      }
  
      if (endByte === -1) {
        endByte = audioEnd;
      }
  
      const trimmed = bytes.subarray(startByte, endByte);
  
      const headers = new Headers();
  
      headers.set("Content-Type", "audio/mpeg");
      headers.set("Content-Length", String(trimmed.byteLength));
  
      // Adjust this depending on whether the source files are private/user-specific.
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
  
      if (request.method === "HEAD") {
        return new Response(null, { headers });
      }
  
      return new Response(trimmed, { headers });
    },
} satisfies ExportedHandler<Env>;


// /Users/sagelokongi/Desktop/freesound_community.mp3