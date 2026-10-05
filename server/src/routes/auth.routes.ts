import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth/better-auth";
import { register, login, getMe } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const authRouter = Router();

// Legacy / Direct API routes
authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.get("/me", authMiddleware, getMe);

// Better Auth endpoints (sign-in/email, sign-up/email, sign-out, get-session, etc.)
const betterAuthHandler = toNodeHandler(auth);
authRouter.all("*", (req, res) => {
  return betterAuthHandler(req, res);
});
