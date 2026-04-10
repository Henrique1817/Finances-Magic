import { getApiBaseUrl } from "@/config/api";
import {
  clearStoredSession,
  getAccessToken,
  getRefreshToken,
} from "@/lib/authSession";
import { refreshSessionRequest } from "@/lib/authApi";

type TranscribeSuccess = {
  success: true;
  data: { text: string };
};

type TranscribeError = {
  success: false;
  error?: string;
};

function extensionForBlob(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a")) return "m4a";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  return "webm";
}

async function transcribeOnce(
  blob: Blob,
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ status: number; json: TranscribeSuccess | TranscribeError }> {
  const fd = new FormData();
  fd.append("audio", blob, `chunk.${extensionForBlob(blob)}`);
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/speech/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: fd,
    signal,
  });
  const raw = await res.text();
  let json: TranscribeSuccess | TranscribeError;
  try {
    json = JSON.parse(raw) as TranscribeSuccess | TranscribeError;
  } catch {
    throw new Error(`Transcrição falhou (${res.status}).`);
  }
  return { status: res.status, json };
}

function messageFromTranscribe(
  status: number,
  json: TranscribeSuccess | TranscribeError,
): string {
  if (!json.success && typeof json.error === "string") return json.error;
  return `Transcrição falhou (${status}).`;
}

/**
 * Transcreve um fragmento de áudio via backend (OpenAI Whisper).
 * Em 401 tenta refresh de sessão uma vez (alinhado ao apiClient).
 */
export async function transcribeSpeechBlob(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error("Inicie sessão para usar voz via servidor.");

  let { status, json } = await transcribeOnce(blob, token, signal);

  if (status === 401) {
    const refresh = getRefreshToken();
    if (!refresh) {
      clearStoredSession();
      throw new Error("Sessão expirada. Entre novamente.");
    }
    try {
      const next = await refreshSessionRequest(refresh);
      const retry = await transcribeOnce(blob, next.access_token, signal);
      status = retry.status;
      json = retry.json;
    } catch {
      clearStoredSession();
      throw new Error("Sessão expirada. Entre novamente.");
    }
  }

  if (!json.success || status >= 400) {
    throw new Error(messageFromTranscribe(status, json));
  }

  return (json.data.text ?? "").trim();
}
