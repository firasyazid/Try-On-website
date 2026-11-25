import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { garments } from "@/features/collection/garments";
import { generateOnHuggingFace, TryOnSpaceError } from "@/features/try-on/hugging-face";
import { acceptsPhoto, maxPhotoBytes } from "@/features/try-on/photo";

export const runtime = "nodejs";
export const maxDuration = 600;

const noStore = { "Cache-Control": "no-store" };

function error(status: number, message: string) {
  return Response.json({ message }, { status, headers: noStore });
}

async function readPhoto(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxPhotoBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  // Next may canonicalize the server URL to localhost on a loopback binding.
  if (origin && origin !== url.origin && origin !== `${url.protocol}//${host}`) {
    return error(403, "Open photo try-on from the showroom.");
  }

  const garment = garments.find((item) => item.id === url.searchParams.get("garment"));
  if (!garment) return error(404, "This garment is unavailable for photo try-on.");

  const photoType = request.headers.get("content-type") ?? "";
  if (!request.body || !acceptsPhoto(photoType)) return error(415, "Choose a JPEG, PNG, or WebP photo.");
  if (Number(request.headers.get("content-length")) > maxPhotoBytes) return error(413, "Choose a photo up to 8 MB.");

  const useHuggingFace = process.env.FASHN_PROVIDER === "huggingface";
  const endpoint = process.env.FASHN_INFERENCE_URL;
  const token = process.env.FASHN_INFERENCE_TOKEN;
  const worker = endpoint && token ? { endpoint, token } : null;
  if (!useHuggingFace && !worker) return error(503, "Photo try-on is offline right now.");

  const photo = await readPhoto(request.body).catch(() => undefined);
  if (photo === null) return error(413, "Choose a photo up to 8 MB.");
  if (!photo?.length) return error(400, "Choose a photo to try on this garment.");

  const garmentImage = await readFile(join(process.cwd(), "public", "images", garment.filename)).catch(() => null);
  if (!garmentImage) return error(404, "The front image for this garment is unavailable.");

  const portrait = new Blob(photo, { type: photoType });
  const timeout = AbortSignal.timeout(580_000);
  const signal = AbortSignal.any([timeout, request.signal]);
  try {
    if (useHuggingFace) {
      const image = await generateOnHuggingFace(portrait, garmentImage, signal);
      return new Response(image, { headers: { ...noStore, "Content-Type": "image/png" } });
    }

    if (!worker) return error(503, "Photo try-on is offline right now.");
    const form = new FormData();
    form.set("person", portrait, "person");
    form.set("garment", new Blob([new Uint8Array(garmentImage)]), garment.filename);
    const result = await fetch(worker.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${worker.token}` },
      body: form,
      cache: "no-store",
      redirect: "error",
      signal,
    });

    if (result.status === 400 || result.status === 422) {
      return error(422, "Use a clear, front-facing photo with your upper body visible.");
    }
    if (result.status === 429) return error(429, "The fitting room is busy. Try again in a moment.");
    if (!result.ok || !result.body || result.headers.get("content-type") !== "image/png") {
      return error(502, "The try-on service couldn't generate a preview. Try again.");
    }

    return new Response(result.body, { headers: { ...noStore, "Content-Type": "image/png" } });
  } catch (cause) {
    if (cause instanceof TryOnSpaceError) {
      if (cause.reason === "invalid-photo") return error(422, "Choose a readable JPEG, PNG, or WebP photo.");
      if (cause.reason === "busy") return error(429, "The free fitting room is busy. Try again in a few minutes.");
      if (cause.reason === "quota") return error(429, "The free GPU quota has been reached. Please try again later.");
    }
    return timeout.aborted
      ? error(504, "The preview took too long. Try again in a moment.")
      : error(502, "The try-on service is temporarily unavailable.");
  }
}
