import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";
import { sendError, sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { transcribeAudioBufferWithOpenAI } from "../services/speech/openaiWhisperTranscribe";

const MIN_AUDIO_BYTES = 900;

export const speechAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

export const postSpeechTranscribeHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }

    if (!env.openaiApiKey) {
      sendError(
        res,
        503,
        "Transcrição por voz indisponível: configure OPENAI_API_KEY no servidor.",
      );
      return;
    }

    const file = req.file;
    if (!file || !file.buffer || file.buffer.length < MIN_AUDIO_BYTES) {
      sendSuccess(res, { text: "" });
      return;
    }

    try {
      const text = await transcribeAudioBufferWithOpenAI({
        buffer: file.buffer,
        mimeType: file.mimetype,
        apiKey: env.openaiApiKey,
        model: env.openaiWhisperModel,
      });
      sendSuccess(res, { text });
    } catch {
      sendError(res, 502, "Falha ao transcrever áudio. Tente novamente.");
    }
  },
);
