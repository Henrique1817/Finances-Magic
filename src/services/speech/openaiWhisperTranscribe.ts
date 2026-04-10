import { logger } from "../../lib/logger";

function extensionForMime(mime: string | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  return "webm";
}

/**
 * Envia áudio à API de transcrições OpenAI (Whisper).
 * Requer `OPENAI_API_KEY` no servidor.
 */
export async function transcribeAudioBufferWithOpenAI(args: {
  buffer: Buffer;
  mimeType: string | undefined;
  apiKey: string;
  model: string;
}): Promise<string> {
  const { buffer, mimeType, apiKey, model } = args;
  if (buffer.length < 256) return "";

  const ext = extensionForMime(mimeType);
  const filename = `audio.${ext}`;
  const bytes = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const raw = await res.text();
  if (!res.ok) {
    logger.warn(
      { status: res.status, bodyPreview: raw.slice(0, 240) },
      "OpenAI Whisper falhou",
    );
    throw new Error(`Whisper HTTP ${res.status}`);
  }

  try {
    const parsed = JSON.parse(raw) as { text?: string };
    return (parsed.text ?? "").trim();
  } catch {
    logger.warn({ rawPreview: raw.slice(0, 120) }, "Resposta Whisper inválida");
    throw new Error("Resposta Whisper inválida.");
  }
}
