import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { auth } from "../auth/better-auth";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // 1. Check Better Auth session via cookies / headers
    const session = await auth.api
      .getSession({
        headers: req.headers as any,
      })
      .catch(() => null);

    if (session && session.user) {
      req.user = {
        userId: session.user.id,
        email: session.user.email,
        role: (session.user as any).role || "user",
      };
      return next();
    }
  } catch (err: any) {
    logger.debug({ err: err.message }, "Better Auth session check bypassed");
  }

  // 2. Fallback to JWT Bearer token if provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
      req.user = payload;
      return next();
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed token verification");
    }
  }

  res.status(401).json({
    error: "Authentication required. Missing or invalid session/token.",
  });
}

// Optional auth middleware for guest / anonymous fallback
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api
      .getSession({
        headers: req.headers as any,
      })
      .catch(() => null);

    if (session && session.user) {
      req.user = {
        userId: session.user.id,
        email: session.user.email,
        role: (session.user as any).role || "user",
      };
      return next();
    }
  } catch {}

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
      req.user = payload;
    } catch {}
  }

  next();
}
