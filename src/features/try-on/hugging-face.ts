import sharp from "sharp";

const officialSpace = "https://fashn-ai-fashn-vton-1-5.hf.space";
const api = "/gradio_api";
const sequence = `${api}/call/try_on`;
const pixelLimit = 36_000_000;

type Failure = "invalid-photo" | "busy" | "quota" | "unavailable";

export class TryOnSpaceError extends Error {
  constructor(readonly reason: Failure) {
    super(reason);
  }
}

async function prepareImage(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: pixelLimit });
  const { format } = await image.metadata();
  if (format !== "jpeg" && format !== "png" && format !== "webp") throw new Error("Unsupported image");

  return image
    .rotate()
    .resize(1536, 2048, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

function failure(status: number, message: string): Failure {
  if (/quota|daily GPU|gpu time.*(exhausted|limit)/i.test(message)) return "quota";
  if (status === 429 || /queue is full/i.test(message)) return "busy";
  return "unavailable";
}

function completedImage(events: string, space: URL) {
  const message = events.match(/^event: (complete|error)\r?\ndata: (.*)$/m);
  if (message?.[1] !== "complete") throw new TryOnSpaceError(failure(0, message?.[2] ?? ""));

  const result = JSON.parse(message[2]) as { url?: string }[];
  const file = new URL(result[0]?.url ?? "", space);
  if (file.origin !== space.origin || !file.pathname.startsWith(`${api}/file=`)) {
    throw new TryOnSpaceError("unavailable");
  }
  return file;
}

export async function generateOnHuggingFace(person: Blob, garment: Buffer, signal: AbortSignal) {
  const space = new URL(process.env.FASHN_SPACE_URL || officialSpace);
  if (space.protocol !== "https:" || !space.hostname.endsWith(".hf.space") || space.username || space.password) {
    throw new TryOnSpaceError("unavailable");
  }
  const token = process.env.HF_TOKEN;

  async function makeRequest(path: string | URL, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(new URL(path, space), {
      ...options,
      headers,
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!res.ok) throw new TryOnSpaceError(failure(res.status, await res.text()));
    return res;
  }

  const personImage = await prepareImage(Buffer.from(await person.arrayBuffer())).catch(() => {
    throw new TryOnSpaceError("invalid-photo");
  });
  const garmentImage = await prepareImage(garment);
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(personImage)], { type: "image/png" }), "person.png");
  form.append("files", new Blob([new Uint8Array(garmentImage)], { type: "image/png" }), "garment.png");

  const upload = await makeRequest(`${api}/upload`, { method: "POST", body: form });
  const files = await upload.json() as string[];
  if (!Array.isArray(files) || files.length !== 2 || files.some((file) => typeof file !== "string")) {
    throw new TryOnSpaceError("unavailable");
  }

  const submit = await makeRequest(sequence, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [...files.map((path) => ({ path, meta: { _type: "gradio.FileData" } })), "tops", "flat-lay", 20, 1.5, 42, true],
    }),
  });
  const { event_id: eventId } = await submit.json() as { event_id?: string };
  if (!eventId || !/^[a-f0-9]+$/i.test(eventId)) throw new TryOnSpaceError("unavailable");

  const events = await makeRequest(`${sequence}/${eventId}`);
  const preview = await makeRequest(completedImage(await events.text(), space));
  const result = await sharp(Buffer.from(await preview.arrayBuffer()), { limitInputPixels: pixelLimit }).png().toBuffer();
  return new Uint8Array(result);
}
