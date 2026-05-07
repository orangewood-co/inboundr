import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../lib/auth";

export interface AuthenticatedRequest extends Request {
  user: Session["user"];
  session: Session["session"];
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user || !session.session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as AuthenticatedRequest).user = session.user;
    (req as AuthenticatedRequest).session = session.session;
    next();
  } catch (err) {
    console.error("Session validation failed:", err);
    res.status(401).json({ error: "Unauthorized" });
  }
}
