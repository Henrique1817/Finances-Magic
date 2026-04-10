import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  postSpeechTranscribeHandler,
  speechAudioUpload,
} from "../../controllers/speechTranscriptionController";
import { authMiddleware } from "../../middlewares/authMiddleware";

export const speechRouter = Router();

const speechTranscribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message:
      "Limite de pedidos de transcrição por minuto excedido. Aguarde e tente novamente.",
  },
});

speechRouter.post(
  "/transcribe",
  speechTranscribeLimiter,
  authMiddleware,
  speechAudioUpload.single("audio"),
  postSpeechTranscribeHandler,
);
