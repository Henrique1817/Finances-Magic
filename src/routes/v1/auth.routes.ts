import { Router } from "express";
import { z } from "zod";

import {
  authLogin,
  authMe,
  authOAuthCallback,
  authOAuthGoogleStart,
  authRefresh,
  authRegister,
} from "../../controllers/authController";
import { asyncHandler } from "../../middleware/asyncHandler";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middleware/validateBody";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const authRouter = Router();

authRouter.post("/login", validateBody(loginBodySchema), asyncHandler(authLogin));
authRouter.post("/register", validateBody(registerBodySchema), asyncHandler(authRegister));
authRouter.post("/refresh", validateBody(refreshBodySchema), asyncHandler(authRefresh));
authRouter.get("/me", authMiddleware, asyncHandler(authMe));
authRouter.get("/oauth/google", asyncHandler(authOAuthGoogleStart));
authRouter.get("/oauth/callback", asyncHandler(authOAuthCallback));
