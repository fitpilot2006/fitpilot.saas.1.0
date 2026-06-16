import type { Request, Response, NextFunction } from "express";
import { verifyToken, type GymTokenPayload, type PlatformAdminTokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      gymId?: number;
      userEmail?: string;
      userRole?: string;
      adminId?: number;
    }
  }
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(token);
    if ((payload as PlatformAdminTokenPayload).role === "platform_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const p = payload as GymTokenPayload;
    req.userId = p.userId;
    req.gymId = p.gymId;
    req.userEmail = p.email;
    req.userRole = p.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(token);
    if ((payload as PlatformAdminTokenPayload).role !== "platform_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const p = payload as PlatformAdminTokenPayload;
    req.adminId = p.adminId;
    req.userEmail = p.email;
    req.userRole = "platform_admin";
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
